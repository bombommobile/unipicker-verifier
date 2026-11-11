// Copyright (c) 2026 ㈜유니피커. All rights reserved.
//
// 이 소스 코드는 추첨 로직을 제3자가 확인할 수 있도록 열람 목적으로 공개합니다.
// 개별 추첨 결과의 검증은 저작권자가 제공하는 공식 웹 검증 환경에서 수행합니다.
// 열람은 허용하지만 직접 실행하거나 빌드할 수 없습니다. 저작권자의 사전 서면 동의 없이
// 복제, 수정, 배포, 재배포, 2차적저작물 작성과 그 밖의 상업적·비상업적 이용을 할 수 없습니다.
// 자세한 이용 조건은 저장소 루트의 LICENSE 를 참조하십시오.
//
// This source code is published so third parties can inspect the draw logic. Verification of an
// individual draw result is performed in the official web verification environment provided by
// the copyright holder. Inspection is permitted; direct execution or building is not. Copying,
// modification, distribution, redistribution, creation of derivative works, and any other
// commercial or non-commercial use are prohibited without the copyright holder's prior written
// consent. See LICENSE in the repository root for the complete terms.

import Rand, { PRNG } from '../vendor/rand-seed.js';

/**
 * The xoshiro RNG, picked by the "random algorithm" setting (XOSHIRO).
 *
 * It consumes the stream of xoshiro128ss seeded with the draw's seed, which is the same seed and the same
 * stream a non-weighted draw uses, so the two stay consistent.
 *
 * The draw logic assumes an RNG offers
 *   - next()           : a uniform real number in [0,1) (rid, weight key)
 *   - nextInt(min,max) : a uniform integer in [min,max], both ends included (the weighted point, Fisher-Yates)
 * plus seed and n (how much has been consumed) for the log. This is the same contract as Sha256Rand, so the
 * weighted logic runs unchanged whichever one it is handed.
 *
 * rand-seed's Rand offers only next() (xoshiro128ss's 32-bit value / 2^32), so nextInt here combines two
 * 32-bit draws into a 53-bit integer and applies rejection sampling — the same precision as Sha256Rand.
 */

const TWO_POW_53 = 9007199254740992;          // 2^53
const TWO_POW_32 = 4294967296;                // 2^32
const TWO_POW_21 = 2097152;                   // 2^21 (53 - 32 = 21 bits)
const MAX_SAFE_INT = Number.MAX_SAFE_INTEGER; // 2^53 - 1

export default class XoshiroRand {
  constructor(seed) {
    // A missing or empty seed is refused rather than allowed to produce a deterministic but wrong draw
    // (same as Sha256Rand).
    if (seed === undefined || seed === null || String(seed) === '') {
      throw new Error('XoshiroRand: seed is empty (a draw needs a seed).');
    }
    // The seed is always a string, for reproducibility. Initialised with xoshiro128ss, as a non-weighted draw is.
    this.seed = String(seed);
    this.n = 0; // how many random numbers have been consumed (for the log): +1 per internal rand.next()
    // Label for the QA log (the same contract as Sha256Rand)
    this.algorithm = 'XOSHIRO';
    this._rand = new Rand(this.seed, PRNG.xoshiro128ss);
  }

  // Consume one internal 32-bit value (a real number in [0,1)) and advance the counter.
  _nextFloat() {
    this.n += 1;
    return this._rand.next();
  }

  /**
   * A uniform real number in [0, 1) — the xoshiro128ss stream, returned as it is.
   * The same value a non-weighted draw gets from rand-seed.next(), which is what keeps replays consistent.
   */
  next() {
    return this._nextFloat();
  }

  // A 53-bit uniform integer: two 32-bit draws combined (top 32 bits + low 21 bits).
  _next53() {
    const hi = Math.floor(this._nextFloat() * TWO_POW_32); // top 32 bits
    const lo = Math.floor(this._nextFloat() * TWO_POW_21); // low 21 bits
    return hi * TWO_POW_21 + lo;
  }

  /**
   * A uniform integer in [min, max], both ends included, with the modulo bias removed by rejection sampling.
   * Only the part of the 53-bit value that divides evenly by the range is used; anything beyond it is thrown
   * away and redrawn. The same contract as Sha256Rand.nextInt (range normalisation, span guard, rejection).
   *
   * ⚠ Contract — max <= min consumes no randomness and returns min, same as Sha256Rand.nextInt. Not to be
   *   changed to a throw — it would move where the RNG is consumed and break replay of past draws.
   */
  nextInt(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error(`XoshiroRand.nextInt: min/max is not a finite number (min=${min}, max=${max}).`);
    }

    min = Math.ceil(min);
    max = Math.floor(max);
    if (max <= min) return min;

    const span = max - min + 1;
    // A span past the safe integer range would lose precision in (r % span) (the same contract as Sha256Rand)
    if (span > MAX_SAFE_INT) {
      throw new Error(`XoshiroRand.nextInt: span is too large (span=${span} > 2^53-1).`);
    }

    // Valid only up to a multiple of the range; the leftover tail is rejected (removes the modulo bias)
    const limit = Math.floor(TWO_POW_53 / span) * span;

    let r;
    do {
      r = this._next53();
    } while (r >= limit);

    return min + (r % span);
  }
}
