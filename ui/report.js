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

// Builds the verdict/summary handed to the result screen and the detailed reproduction log text.
// ⚠ The full run stays in the Worker; only the text produced here crosses to the main thread.
// ⚠ Only headings and verdict wording go through the dictionary. Values read from the file (entry data, group names) are written verbatim.

import { t } from '../i18n/index.js';
import { categoryLabel } from '../domain/categories.js';

const yesNo = (v) => (v ? 'Y' : '');
const val = (v) => (v == null ? '' : v);

/**
 * Describes the sort direction, including which value's last character it was derived from.
 * ⚠ Ball-number draws derive it from the ball number, not the seed. Saying "seed" would state a wrong reason.
 */
export const sortOrderLabel = (sortOrderType, src) => {
  const dir = t(sortOrderType === 0 ? 'sortOrder.asc' : 'sortOrder.desc');
  if (!src) return dir;
  const what = t(src.kind === 'ball' ? 'sortOrder.byBall' : 'sortOrder.bySeed');
  if (!src.numeric) return t('sortOrder.nonNumeric', { dir, what, last: src.lastChar });
  return t('sortOrder.derived', { dir, what, last: src.lastChar, parity: t(sortOrderType === 0 ? 'sortOrder.odd' : 'sortOrder.even') });
};

/** Verdict label. Screen and log share the same wording. */
export const verdictLabel = (verdict) => t(`verdict.${verdict}`);

/**
 * Detailed reproduction log: per-entry random values, winning order and sort direction, written as they are.
 * @param {{verdict: string, log: object}} ctx return value of runVerify
 * @returns {string[]} lines (kept as an array and passed straight to a Blob to avoid building one huge string)
 */
export const buildLogLines = (ctx) => {
  const { verdict, log } = ctx;
  const cat = log.category;
  const isBall = !!cat.categoryInfo.isBallNumberInputDrawing;
  const isWeight = !!cat.weight;
  const isWeightB = isWeight && log.form && log.form.weightDrawMethod === 'B';
  const isWeightA = isWeight && !isWeightB;
  const s = log.compare.summary;
  const rep = log.reproduced;

  const lines = [
    t('log.title'),
    '',
    t('log.category', { value: categoryLabel(cat) }),
    t('log.seed', { value: log.seed }),
    t('log.algorithm', { value: log.algorithm }),
    t('log.sortOrder', { value: sortOrderLabel(rep.sortOrderType, rep.sortOrderSource) }),
    t('log.rngConsumed', { value: rep.rngConsumed }),
    t('log.winnerCounts', { expected: s.winner.expected, actual: s.winner.actual, matched: s.winner.matched }),
    t('log.preliminaryCounts', { expected: s.preliminary.expected, actual: s.preliminary.actual, matched: s.preliminary.matched }),
    t('log.verdict', { value: verdictLabel(verdict) }),
    '',
    t('log.privacyNotice'),
    '',
  ];

  const entryList = rep.entryList || [];
  if (entryList.length > 0) {
    // The evidence differs per category, so the columns differ too (weighted draws do not use rid)
    // For group draws, which group an entry belongs to is where reading the evidence starts
    const hasType = entryList.some((e) => e.entryType && e.entryType !== 'UNI_PKR_NONE');
    const col = (k) => t(`log.col.${k}`);
    const cols = [col('seq')];
    if (hasType) cols.push(col('entryType'));
    cols.push(col('entryData'));
    if (!isWeight) cols.push(col('rid'));
    if (isBall) cols.push(col('ballNumber'), col('drawRid'), col('drawUseRid'));
    if (isWeightA) cols.push(col('weight'), col('shuffleOrder'));
    if (isWeightB) cols.push(col('weight'), col('weightKey'));
    cols.push(col('isWinner'), col('winnerOrder'), col('winnerGroup'), col('isPreliminary'));
    lines.push(t('log.entryTableTitle'), cols.join('\t'));

    for (const e of entryList) {
      const row = [e.seq];
      if (hasType) row.push(val(e.entryType));
      row.push(val(e.entryDataOriginal != null ? e.entryDataOriginal : e.entryData));
      if (!isWeight) row.push(val(e.rid));
      if (isBall) row.push(val(e.ballNumber), val(e.drawRid), val(e.drawUseRid));
      if (isWeightA) row.push(val(e.entryEssentialData), val(e.shuffleOrder));
      if (isWeightB) row.push(val(e.entryEssentialData), val(e.weightKeyB));
      row.push(yesNo(e.isWinner), val(e.winnerOrder), val(e.winnerEntryGroup), yesNo(e.isPreliminary));
      lines.push(row.join('\t'));
    }
    lines.push('');
  }

  if (rep.drawLogs && rep.drawLogs.length > 0) {
    lines.push(t('log.drawLogTitle'), ...rep.drawLogs, '');
  }

  return lines;
};

/** The lines joined into one string */
export const buildLogText = (ctx) => buildLogLines(ctx).join('\r\n');

/**
 * Head of the log for the on-screen preview; the whole thing is available as a download.
 */
export const logPreview = (lines, maxLines = 200) => {
  const all = Array.isArray(lines) ? lines : String(lines).split('\r\n');
  return { text: all.slice(0, maxLines).join('\n'), truncated: all.length > maxLines, totalLines: all.length };
};
