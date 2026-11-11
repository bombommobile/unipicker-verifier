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

// Pure comparer between the reproduction and the result file: winners and backups are matched position by position.
// ⚠ The comparison is by identity (the winner's entry data) at each position. Group labels differ between reproduction and file, so they are shown but never judged on.

// The internal marker for a category without groups (UNI_PKR_NONE) is never shown on screen
const NONE = 'UNI_PKR_NONE';
const plain = (v) => {
  const s = String(v == null ? '' : v);
  return s === NONE ? '' : s;
};

// Order-independent pair key, for tournament and other pairing draws
export const pairKey = (a, b) => [String(a == null ? '' : a), String(b == null ? '' : b)].sort().join(' | ');

// Normalises a reproduced winnerList into the standard comparison rows, keyed on the original entry data (before masking).
// ⚠ When opts.isMatchDraw states whether this is a pairing draw, that value wins over per-row guessing, so it cannot disagree with how the file side read it.
export const normalizeReproduced = (winnerList, opts = {}) =>
  (winnerList || []).map((w) => {
    const orig = w.entryDataOriginal != null ? w.entryDataOriginal : w.entryData != null ? w.entryData : '';
    const isMatch = opts.isMatchDraw != null ? !!opts.isMatchDraw : w.matchEntryDataOriginal != null || w.matchEntryData != null;
    const matchOrig = w.matchEntryDataOriginal != null ? w.matchEntryDataOriginal : w.matchEntryData != null ? w.matchEntryData : '';
    return {
      entryData: isMatch ? pairKey(orig, matchOrig) : String(orig),
      // The group that came from the entrant file, placed beside the same column of the result file so it is visible who belongs where
      type: plain(w.winnerEntryType),
      // Companion assignment joins the winning groups with commas, so the per-row group (winnerListEntryGroup) comes first; the result file stores that value too
      group: plain(w.winnerListEntryGroup != null ? w.winnerListEntryGroup : w.winnerEntryGroup),
      order: Number(w.winnerOrder != null ? w.winnerOrder : 0),
      isPreliminary: !!w.isPreliminary,
    };
  });

// One row matches when the winner's identity (the entry data) is the same. Group labels are display only and stay out of the decision.
// ⚠ An empty identity on both sides is not an identity match — it means neither side could be read.
const rowMatch = (a, b) => !!a && !!b && a.entryData === b.entryData && a.entryData !== '';

// Compares two lists position by position, yielding the first mismatch and a per-row result
const compareList = (expected, actual) => {
  const len = Math.max(expected.length, actual.length);
  const rows = [];
  let matched = 0;
  let firstMismatch = null;
  for (let i = 0; i < len; i++) {
    const e = expected[i] || null;
    const a = actual[i] || null;
    const ok = rowMatch(e, a);
    if (ok) matched++;
    else if (firstMismatch === null) firstMismatch = i;
    rows.push({ index: i, order: e ? e.order : a ? a.order : i + 1, group: e ? e.group : a ? a.group : '', expected: e, actual: a, ok });
  }
  return {
    expectedTotal: expected.length,
    actualTotal: actual.length,
    matched,
    firstMismatch, // 0-based; null means everything matched
    countMismatch: expected.length !== actual.length,
    rows,
  };
};

/**
 * Compares the reproduction against the result file.
 * @param {Array} reproducedRows the result of normalizeReproduced(), or rows in the same shape
 * @param {Array} fileRows rows in that same shape, produced by the result-file parser
 * @returns the verdict, a summary, and the diff for winners and backups
 */
export const compare = (reproducedRows, fileRows) => {
  const expMain = reproducedRows.filter((r) => !r.isPreliminary);
  const expPre = reproducedRows.filter((r) => r.isPreliminary);
  const actMain = fileRows.filter((r) => !r.isPreliminary);
  const actPre = fileRows.filter((r) => r.isPreliminary);

  const winner = compareList(expMain, actMain);
  const preliminary = compareList(expPre, actPre);

  const isMatch =
    winner.firstMismatch === null && !winner.countMismatch && preliminary.firstMismatch === null && !preliminary.countMismatch;

  return {
    isMatch,
    summary: {
      winner: { expected: winner.expectedTotal, actual: winner.actualTotal, matched: winner.matched },
      preliminary: { expected: preliminary.expectedTotal, actual: preliminary.actualTotal, matched: preliminary.matched },
    },
    winner,
    preliminary,
  };
};

export default compare;
