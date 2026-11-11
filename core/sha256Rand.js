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

import { sha256 } from '../vendor/js-sha256.js';

/* global BigInt */

/**
 * The SHA-256 RNG used by weighted draws.
 *
 * random = SHA256( seed || "|" || N )   // N = 0, 1, 2, … counted from 0 when the instance is created
 *  - || means concatenation: the seed (a string), the separator "|", and the counter N (a string).
 *  - The separator pins the boundary between seed and counter, so the (seed, N) encoding stays unique even
 *    when the seed is itself a run of digits. That keeps the replay specification unambiguous.
 *  - Every call increases N by one and consumes the next hash.
 *
 * next() returns a real number in [0,1), the same contract XoshiroRand offers.
 * The encoding of the input (N) and the way bits are taken out are fixed to one form, so an outside party
 * can reproduce the stream.
 */

const SEED_SEPARATOR = '|';                 // seed/counter boundary (fixed by the replay specification)
const TWO_POW_53 = 9007199254740992;        // 2^53
const MAX_SAFE_INT = Number.MAX_SAFE_INTEGER; // 2^53 - 1
const TWO_POW_256 = 1n << 256n;             // 2^256

// SHA-256 as a hex string (64 hex chars = 256 bits).
// js-sha256 is pure JavaScript and returns the hex string directly. Its output matches
// Node's crypto.createHash('sha256'), so a replay in a browser and a run in the app agree.
const sha256hex = (input) => sha256(String(input));

export default class Sha256Rand {
  constructor(seed) {
    // A missing or empty seed is refused rather than allowed to produce a deterministic but wrong draw.
    if (seed === undefined || seed === null || String(seed) === '') {
      throw new Error('Sha256Rand: seed is empty (a weighted draw needs a seed).');
    }
    // The seed is always a string, for reproducibility
    this.seed = String(seed);
    this.n = 0;
    // Label for the QA log (a plain string, so a minified build still reports it correctly)
    this.algorithm = 'SHA256';
  }

  // Return the 256-bit hash integer for the current counter and advance the counter by one.
  _next256() {
    const hex = sha256hex(this.seed + SEED_SEPARATOR + this.n);
    this.n += 1;
    return BigInt('0x' + hex);
  }

  /**
   * A uniform real number in [0, 1).
   * The top 53 bits of the 256-bit hash divided by 2^53 (safe integer precision).
   * The same contract as XoshiroRand.next().
   */
  next() {
    const bits53 = this._next256() >> 203n;   // 256 - 53 = 203, so this leaves the top 53 bits
    return Number(bits53) / TWO_POW_53;
  }

  /**
   * A uniform integer in [min, max], both ends included, with the modulo bias removed by rejection sampling.
   * Only the part of the 256-bit value that divides evenly by the range is used; anything beyond it is
   * thrown away and redrawn.
   *
   * ⚠ Contract — max <= min consumes no randomness and returns min (an empty or inverted range is not an
   *   error). XoshiroRand.nextInt has the same contract. Not to be changed to a throw — it would move where
   *   the RNG is consumed and break replay of past draws.
   */
  nextInt(min, max) {
    // Guard against arguments that would throw when converted to BigInt (NaN, Infinity)
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error(`Sha256Rand.nextInt: min/max is not a finite number (min=${min}, max=${max}).`);
    }

    min = Math.ceil(min);
    max = Math.floor(max);
    if (max <= min) return min;

    const span = max - min + 1;
    // A span past the safe integer range would lose precision in Number(r % range). Real weight totals never
    // reach it, but the contract is stated explicitly rather than left to chance.
    if (span > MAX_SAFE_INT) {
      throw new Error(`Sha256Rand.nextInt: span is too large (span=${span} > 2^53-1).`);
    }

    const range = BigInt(span);
    // Valid only up to a multiple of the range; the leftover tail is rejected (removes the modulo bias)
    const limit = (TWO_POW_256 / range) * range;

    let r;
    do {
      r = this._next256();
    } while (r >= limit);

    return min + Number(r % range);
  }
}
