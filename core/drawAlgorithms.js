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

// The pure core of the draw algorithms — rejection sampling, Floyd sampling, Fisher-Yates, the weight key
// and the seed parity that sets the sort direction.
// ⚠ These functions have no side effects and assume only the rng contract (next() / nextInt()).
//   Logging is handed to a callback or an array.

// Sort direction values — the numbers the sort function takes, as they are.
// ⚠ 0 and 1 are stored and passed around, so they do not change. This only gives them names.
export const SORT_ASC = 0;
export const SORT_DESC = 1;

/**
 * Sort direction — an even last character of the seed means descending, an odd one ascending.
 * White paper: "an odd seed sorts ascending, an even seed descending".
 * (A ball-number draw passes the ball number instead of the seed and gets the same rule.)
 *
 * ⚠ Contract — a non-digit last character ('a' % 2 is NaN) falls back to ascending. That fallback is not an
 *   error: direction decides the result, so changing it would break replay of past draws. Unreached in
 *   practice — the seed is always digits and every other caller passes a ball number.
 * @param {string|number} seed
 * @returns {0|1} SORT_ASC(0) = ascending, SORT_DESC(1) = descending
 */
export const deriveSortDirection = (seed) => {
  const s = String(seed);
  const decision = s.charAt(s.length - 1);
  if (decision % 2 === 0) return SORT_DESC;
  return SORT_ASC;
};

/**
 * Weight key (Efraimidis-Spirakis) — key = -ln(u) / w.
 * A larger weight w makes the key smaller, so it sorts forward and wins first.
 * u = 0 or w <= 0 gives +Infinity, which sorts last.
 * White paper: "key = -ln(u) / w".
 * @param {number} u random number in [0,1)
 * @param {number} w the entrant's weight
 * @returns {number} the weight key
 */
export const weightKey = (u, w) => (w > 0 ? -Math.log(u) / w : Infinity);

/**
 * An unbiased uniform integer in 1..N (rejection sampling).
 * A 53-bit integer is assembled from rng.next(), and anything at or above floor(2^53 / N) * N — the leftover
 * tail — is thrown away and redrawn, which removes the modulo bias.
 * White paper: "unfair-random rejection policy — only the range that is a multiple of the entrant count is
 * used, anything beyond it is rejected".
 * @param {{next: () => number}} rng
 * @param {number} N a positive integer
 * @param {string[]} [log] optional array to collect diagnostic lines
 * @returns {number} an integer in 1..N (= (random % N) + 1)
 */
export const uniformInt1toN = (rng, N, log = []) => {
  if (!Number.isInteger(N) || N <= 0) throw new Error('N must be a positive integer');

  // Sample safely within 53-bit precision (26 high bits + 27 low bits)
  const next53 = () => {
    const hi = Math.floor(rng.next() * (1 << 26)); // 0 ~ 2^26-1
    const lo = Math.floor(rng.next() * (1 << 27)); // 0 ~ 2^27-1
    return hi * (1 << 27) + lo; // 0 ~ 2^53-1
  };

  const MAX = Math.pow(2, 53); // 2^53 = 9,007,199,254,740,992
  const limit = Math.floor(MAX / N) * N; // upper bound of the unbiased range
  log.push(`상한 난수 값 = [1...${N}][${limit}]`);

  let x;
  do {
    x = next53();
    log.push(`${log.length}차 생성 난수 = [${x}]`);
  } while (x >= limit); // anything outside the range is discarded (rejection sampling)

  return (x % N) + 1;
};

/**
 * Fisher-Yates shuffle (in place) — from the end of the array, swap with j = rand.nextInt(0, i).
 * An unbiased shuffle: every permutation is equally likely. White paper: "Fisher-Yates shuffle".
 * @param {{nextInt: (min: number, max: number) => number}} rand
 * @param {Array} arr the array to shuffle (mutated in place)
 * @returns {Array} arr (the same reference)
 */
export const fisherYatesShuffle = (rand, arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand.nextInt(0, i);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
};

/**
 * Floyd's sampling without replacement — pick k distinct values out of [1..N] in O(k) time and memory.
 * For i = N-k+1 .. N, draw t ~ Uniform(1..i); if t has already been taken, put i in instead. i has not been
 * taken yet, so it can never collide, and nothing has to be redrawn.
 * White paper: "Floyd's Sampling Without Replacement".
 * ⚠ The returned set is uniform but the pick order is not a uniform permutation — re-shuffle separately if the order is exposed in the result.
 * ⚠ Contract — only k is checked. N is trusted to be an integer; checking it would move where the RNG is
 *   consumed and break replay of past draws. The caller always passes an integer range size.
 * @param {{next: () => number}} rng
 * @param {number} N the total (the entrant count) — must be an integer, unchecked
 * @param {number} k how many to pick (the winner count)
 * @param {(info: {index: number, t: number, i: number, picked: number, collision: boolean, log: string[]}) => void} [onDraw]
 *        optional per-round callback, used to hand logging outwards
 * @returns {number[]} the drawn numbers, in the order they were picked, distinct, each in 1..N
 */
export const floydSample = (rng, N, k, onDraw) => {
  if (!Number.isInteger(k) || k <= 0) throw new Error('k must be a positive integer');
  if (k > N) throw new Error('k cannot exceed N');

  const chosen = new Map(); // fast membership check
  const order = [];

  let index = 0;
  for (let i = N - k + 1; i <= N; i++) {
    const log = [];
    const t = uniformInt1toN(rng, i, log); // 1..i
    const collision = chosen.has(t);
    const picked = collision ? i : t;
    chosen.set(picked, true);
    order.push(picked);
    if (onDraw) onDraw({ index, t, i, picked, collision, log });
    index++;
  }

  return order;
};
