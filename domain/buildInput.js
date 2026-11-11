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

// Pure module that validates the screen inputs and parsed files, then assembles the reproduce() input.
// ⚠ Direct entry and the all-in-one backup mode become a single row (seq 0), as in the draw: the row count is the number of random values consumed.

import { FIELD_ID } from '../pipeline/fieldId.js';
import { PRELIMINARY_ORDER_TYPE, RANDOM_ALGORITHM_TYPE, WEIGHT_DRAW_METHOD } from '../pipeline/constants.js';
import { msg, MessageError } from '../msg/index.js';

// Backup-winner prefixes and their "all" labels. The draw writes these in whichever UI language it ran in (Korean or English).
// ⚠ Never take them from the screen dictionary: what matters is the language written in the file, not the language on screen.
const PRELIM_PREFIXES = ['예비당첨자', 'Backup Winner'];
const ALL_LABELS = { 예비당첨자: '전체', 'Backup Winner': 'All' };

const num = (v) => (v == null || v === '' ? NaN : Number(v));
const str = (v) => String(v == null ? '' : v);
// A missing count means 1, matching how the engine (winSettingCount) treats a missing value
const winCountOf = (v) => (v == null || v === '' ? 1 : Number(v));

// The entrant column sits at a fixed position per category, so a file that renamed the header is still recognised by position.
// ⚠ If a known info-column name shows up in that position, the wrong category was picked; report it instead of guessing. Files saved in either locale are accepted.
export const INFO_HEADERS = [
  '이름', '휴대폰번호', '이메일', '기타', '가중치', '당첨 가능 개수', '분류', '그룹', '하위그룹', '배분 그룹',
  '등수/경품/그룹', '순번', '예비당첨자 수',
  'Name', 'Mobile', 'Email', 'Other', 'Drawing Weight', 'Number of winning chances', 'Group', 'Grouping',
  'Subgroup', 'Assignment Group', 'Backup Winner Amount',
];
export const entrantNameAt = (grid, col) => {
  const name = String(grid[0] == null || grid[0][col] == null ? '' : grid[0][col]).trim();
  if (!name || INFO_HEADERS.includes(name)) {
    throw new MessageError('msg.parse.categoryColumnMismatch');
  }
  return name;
};

/**
 * Maps the parsed win-setting file (main/preliminary) onto the engine's winSettingList and preliminaryList.
 * @param {{main:Array, preliminary:Array, prelimMode:string|null}} parsed result of parseWinSettingGrid
 * @param {string[]} wsShape column mapping; when the last entry is winCount the value column is a count, otherwise it is that field (one person per row)
 */
export const mapWinSetting = (parsed, wsShape) => {
  const hasCount = wsShape[wsShape.length - 1] === FIELD_ID.WIN_COUNT;
  const labelFields = wsShape.slice(0, -1);
  const valueField = hasCount ? null : wsShape[wsShape.length - 1];

  // In the three-column subgroup shape the backup rows carry the prefix in their second column, and the parser only looks at the first cell, so they are reclassified here
  const mainRows = [];
  const extraPrelimRows = [];
  for (const row of parsed.main) {
    const second = String(row.labels[1] == null ? '' : row.labels[1]);
    if (labelFields.length >= 2 && PRELIM_PREFIXES.includes(second)) extraPrelimRows.push(row);
    else mainRows.push(row);
  }

  const winSettingList = mainRows.map((row, i) => {
    const item = { seq: i + 1, [FIELD_ID.WIN_COUNT]: hasCount ? winCountOf(row.value) : 1 };
    labelFields.forEach((f, k) => {
      if (row.labels[k] != null && row.labels[k] !== '') item[f] = String(row.labels[k]);
    });
    if (valueField && row.value != null && row.value !== '') item[valueField] = String(row.value);
    return item;
  });

  // Backup rows: those the parser classified (prefix in the first column) plus the ones reclassified above. An "all" label means ALL, any other group name means TYPE
  let allCount = null;
  const typeRows = [];
  for (const row of parsed.preliminary) {
    if (parsed.prelimMode === 'ALL') allCount = winCountOf(row.value);
    else typeRows.push({ group: row.group, value: row.value });
  }
  const allLabelValues = Object.values(ALL_LABELS); // the "all" label in either locale
  for (const row of extraPrelimRows) {
    const first = String(row.labels[0] == null ? '' : row.labels[0]);
    if (allLabelValues.includes(first)) allCount = winCountOf(row.value);
    else typeRows.push({ group: first, value: row.value });
  }

  let preliminaryList = [];
  let prelim = { use: false, method: null, count: 0 };
  if (allCount != null) {
    preliminaryList = [
      { seq: 0, [FIELD_ID.ENTRY_TYPE]: FIELD_ID.PRELIMINARY_ALL, [FIELD_ID.WIN_COUNT]: allCount, [FIELD_ID.IS_PRELIMINARY]: true },
    ];
    prelim = { use: true, method: PRELIMINARY_ORDER_TYPE.ALL.id, count: allCount };
  } else if (typeRows.length > 0) {
    preliminaryList = typeRows.map((row, i) => ({
      seq: i + 1,
      [FIELD_ID.ENTRY_TYPE]: row.group,
      [FIELD_ID.WIN_COUNT]: winCountOf(row.value),
      [FIELD_ID.IS_PRELIMINARY]: true,
    }));
    prelim = { use: true, method: PRELIMINARY_ORDER_TYPE.TYPE.id, count: 0 };
  }
  return { winSettingList, preliminaryList, prelim };
};

// How order is assigned in a backup-order draw: the choice made on screen (all, or by group); null for other categories.
// ⚠ Screen, run and assembly must read the same rule, or the file the page asks for and the input it builds will disagree.
export const prelimOrderMethodOf = (cat, form) =>
  cat && cat.winSetting === 'prelimOrder'
    ? (form || {}).prelimOrderMethod === PRELIMINARY_ORDER_TYPE.TYPE.id
      ? PRELIMINARY_ORDER_TYPE.TYPE.id
      : PRELIMINARY_ORDER_TYPE.ALL.id
    : null;

// Whether a win-setting file is actually used; a backup-order draw needs one only in the by-group mode
export const usesWinSettingFile = (cat, form) =>
  !!cat && (cat.winSetting === 'file' || prelimOrderMethodOf(cat, form) === PRELIMINARY_ORDER_TYPE.TYPE.id);

/**
 * Maps the win setting of a backup-order draw. A single "all" row becomes one row (seq 0), the same shape convertWinCountToList produces.
 * ⚠ The all mode ignores groups and draws from one pool, so keeping entryType here would leave nobody a winner.
 * @param {Array} mainRows the main rows from parseWinSettingGrid
 */
export const mapPrelimOrderWinSetting = (mainRows) => {
  const allLabelValues = Object.values(ALL_LABELS); // the "all" label in either locale
  const first = String(mainRows[0] && mainRows[0].labels[0] != null ? mainRows[0].labels[0] : '').trim();
  if (mainRows.length === 1 && allLabelValues.includes(first)) {
    return {
      winSettingList: [{ seq: 0, [FIELD_ID.ENTRY_TYPE]: FIELD_ID.PRELIMINARY_ALL, [FIELD_ID.WIN_COUNT]: winCountOf(mainRows[0].value) }],
      method: PRELIMINARY_ORDER_TYPE.ALL.id,
    };
  }
  return {
    winSettingList: mainRows.map((row, i) => ({
      seq: i + 1,
      [FIELD_ID.ENTRY_TYPE]: String(row.labels[0] == null ? '' : row.labels[0]),
      [FIELD_ID.WIN_COUNT]: winCountOf(row.value),
    })),
    method: PRELIMINARY_ORDER_TYPE.TYPE.id,
  };
};

const sumWinCount = (list) => list.reduce((s, w) => s + winCountOf(w[FIELD_ID.WIN_COUNT]), 0);

/**
 * Validates the screen state and assembles the reproduce() input.
 * @param {object} state { category, seed, algorithm, entry, winSettingParsed, resultParsed, manifest, form }
 * @returns {{ errors:Array, warnings:Array, input:object|null, summary:object|null }}
 *   errors and warnings carry { field, code, params } rather than wording; translation happens only in the UI layer
 */
export const buildReproduceInput = (state) => {
  const errors = [];
  const warnings = [];
  const err = (field, code, params) => errors.push({ field, ...msg(code, params) });
  const warn = (field, code, params) => warnings.push({ field, ...msg(code, params) });

  const cat = state.category;
  if (!cat) {
    err('category', 'msg.input.category');
    return { errors, warnings, input: null, summary: null };
  }
  const form = state.form || {};
  const isMass = !!cat.categoryInfo.isMassDraw;
  // Lucky-number draws build their entrants from a number range instead of reading an entrant file
  const isRangeEntry = cat.entrySource === 'range';

  // Seed and algorithm
  const seed = String(state.seed == null ? '' : state.seed).trim();
  if (!seed) err('seed', 'msg.input.seed');
  const algorithm = state.algorithm;
  if (algorithm !== RANDOM_ALGORITHM_TYPE.SHA256 && algorithm !== RANDOM_ALGORITHM_TYPE.XOSHIRO) {
    err('algorithm', 'msg.input.algorithm');
  }

  // Entrants (a mass draw reads the zip manifest, a lucky-number draw a number range)
  let entryRows = [];
  let luckyRange = null;
  if (isRangeEntry) {
    const start = num(form.startLuckyNumberRange);
    const end = num(form.endLuckyNumberRange);
    // ⚠ The range is the entrant list. A wrong end value changes how many numbers the RNG stream is spent on.
    if (!Number.isInteger(start) || start < 1 || !Number.isInteger(end) || end < start) err('entry', 'msg.input.luckyRange');
    else luckyRange = { start, end };
  } else if (isMass) {
    if (!state.manifest) err('entry', 'msg.file.entryZip');
    else {
      if (!state.manifest.linesMatch) warn('entry', 'msg.input.manifestLinesMismatch', { total: state.manifest.totalLines, sum: state.manifest.sumLines });
      if (!(state.manifest.totalLines > 0)) err('entry', 'msg.input.manifestZeroLines');
    }
  } else {
    if (!state.entry) err('entry', 'msg.file.entry');
    else if (!state.entry.rows || state.entry.rows.length < 1) err('entry', 'msg.input.entryEmpty');
    else entryRows = state.entry.rows;
  }

  // Group categories require a group column (matched against the header the draw writes, in either locale)
  if (cat.entryHasType && entryRows.length > 0 && !entryRows.some((r) => r.entryType != null)) {
    err('entry', 'msg.input.entryNeedGroup');
  }

  // Weighted draws require a numeric weight column
  let totalDrawingWeight = 0;
  if (cat.weight && entryRows.length > 0) {
    let hasInvalid = false;
    let hasZero = false;
    for (const r of entryRows) {
      const w = num(r[FIELD_ID.ENTRY_ESSENTIAL_DATA]);
      if (Number.isNaN(w)) { hasInvalid = true; break; }
      if (w <= 0) hasZero = true;
      totalDrawingWeight += w;
    }
    if (hasInvalid) err('entry', 'msg.input.entryNeedWeight');
    else if (hasZero) warn('entry', 'msg.input.weightZero');
  }
  // Companion assignment: each entrant's winnable count is how many tickets they take, so reproduction does not hold without it
  let companionTotal = 0;
  if (cat.companion && entryRows.length > 0) {
    let hasInvalid = false;
    for (const r of entryRows) {
      const c = num(r[FIELD_ID.ENTRY_ESSENTIAL_DATA]);
      if (Number.isNaN(c) || c < 0) { hasInvalid = true; break; }
      companionTotal += Number(c || 1); // same expression as the engine: 0 counts as one ticket there too
    }
    if (hasInvalid) err('entry', 'msg.input.entryNeedCompanion');
  }

  // Lottery weights: the snapshot of per-number hit counts is the weight. The array index is the number, so it is never sorted or filtered.
  // ⚠ The total is re-summed over the range instead of taken from the bundle; a different total would make it a different draw.
  const lotteryWeightUse = !!cat.categoryInfo.isLotteryNumberDrawing && form.lotteryNumberWeightUse === true;
  let lotteryStat = null;
  if (lotteryWeightUse) {
    const stat = Array.isArray(form.lotteryStat) ? form.lotteryStat : null;
    if (!stat || !luckyRange || stat.length < luckyRange.end) err('entry', 'msg.input.lotteryStat');
    else {
      let hasInvalid = false;
      for (let i = luckyRange.start; i <= luckyRange.end; i++) {
        const w = num(stat[i - 1]);
        if (Number.isNaN(w) || w < 0) { hasInvalid = true; break; }
        totalDrawingWeight += w;
      }
      if (hasInvalid) err('entry', 'msg.input.lotteryStat');
      else lotteryStat = stat;
    }
  }

  const weightDrawMethod = cat.weight
    ? (form.weightDrawMethod === WEIGHT_DRAW_METHOD.RANK ? WEIGHT_DRAW_METHOD.RANK : WEIGHT_DRAW_METHOD.SECTION)
    : undefined;

  // Win setting: read from a file, entered directly, or absent (tournament)
  let winSettingList = [];
  let preliminaryList = [];
  let prelim = { use: false, method: null, count: 0 };
  let drawingCount = 0;
  let prelimOrderMethod = null;
  if (cat.winSetting === 'prelimOrder') {
    prelimOrderMethod = prelimOrderMethodOf(cat, form);
    if (prelimOrderMethod === PRELIMINARY_ORDER_TYPE.ALL.id) {
      // All (combined): one row (seq 0) as convertWinCountToList produces, consuming one random value
      drawingCount = num(form.drawingCount);
      if (!Number.isInteger(drawingCount) || drawingCount < 1) {
        err('winSetting', 'msg.input.prelimCount');
        drawingCount = 0;
      } else {
        winSettingList = [
          { seq: 0, [FIELD_ID.ENTRY_TYPE]: FIELD_ID.PRELIMINARY_ALL, [FIELD_ID.WIN_COUNT]: drawingCount, [FIELD_ID.IS_PRELIMINARY]: false },
        ];
      }
    } else if (!state.winSettingParsed) {
      err('winSetting', 'msg.input.winSettingPrelimOrder');
    } else if (!state.winSettingParsed.main || state.winSettingParsed.main.length < 1) {
      err('winSetting', 'msg.input.winSettingEmpty');
    } else if (state.winSettingParsed.main.some((row) => row.labels.length !== 1)) {
      // Anything but one group column plus one count column is another category's setting file; reproducing it silently would end with nobody winning
      err('winSetting', 'msg.input.winSettingShape', { category: msg(`category.${cat.id}`) });
    } else if (state.winSettingParsed.preliminary.length > 0) {
      err('winSetting', 'msg.input.winSettingPrelimPrefix');
    } else {
      const mapped = mapPrelimOrderWinSetting(state.winSettingParsed.main);
      if (mapped.method === PRELIMINARY_ORDER_TYPE.ALL.id) {
        err('winSetting', 'msg.input.winSettingPrelimAll');
      } else {
        winSettingList = mapped.winSettingList;
      }
    }
  } else if (cat.winSetting === 'file') {
    if (!state.winSettingParsed) {
      err('winSetting', 'msg.file.winSetting');
    } else if (!state.winSettingParsed.main || state.winSettingParsed.main.length < 1) {
      err('winSetting', 'msg.input.winSettingEmpty');
    } else {
      const labelCount = cat.wsShape.length - 1;
      const short = state.winSettingParsed.main.some((row) => row.labels.length < labelCount);
      if (short) {
        err('winSetting', 'msg.input.winSettingShape', { category: msg(`category.${cat.id}`) });
      } else {
        const mapped = mapWinSetting(state.winSettingParsed, cat.wsShape);
        winSettingList = mapped.winSettingList;
        preliminaryList = mapped.preliminaryList;
        prelim = mapped.prelim;
        const expected = cat.prelim == null ? [] : [].concat(cat.prelim);
        if (prelim.use && expected.length < 1) warn('winSetting', 'msg.input.prelimUnexpected');
        else if (prelim.use && !expected.includes(prelim.method)) {
          warn('winSetting', 'msg.input.prelimMethodMismatch', { method: prelim.method, expected: expected.join('/') });
        }
      }
    }
  } else if (cat.winSetting === 'direct') {
    drawingCount = num(form.drawingCount);
    if (!Number.isInteger(drawingCount) || drawingCount < 1) {
      err('winSetting', 'msg.input.drawingCount');
      drawingCount = 0;
    } else {
      // Same as convertWinCountToList: one row (seq 0), consuming one random value
      winSettingList = [{ seq: 0, [FIELD_ID.WIN_COUNT]: drawingCount, [FIELD_ID.IS_PRELIMINARY]: false }];
    }
  }
  // 'none' (tournament) proceeds without a win setting

  // Ball number
  if (cat.ball) {
    const ballNumber = String(form.ballNumber == null ? '' : form.ballNumber).trim();
    if (!/^\d+$/.test(ballNumber)) err('ball', 'msg.input.ballNumber');
  }

  // Duplicate-win limit: group categories use the same per-group count model as the draw (GROUP/GROUPNONE).
  // In the all mode of a backup-order draw the setting is hidden and pinned to "no duplicate wins", so taking the screen choice would invent a condition the draw never had
  const dupFixed = cat.dup && prelimOrderMethod === PRELIMINARY_ORDER_TYPE.ALL.id;
  if (dupFixed && Number(form.dupUse ?? FIELD_ID.IMPOSSIBLE) !== FIELD_ID.IMPOSSIBLE) {
    warn('dup', 'msg.input.dupFixed');
  }
  const dupUse = dupFixed ? FIELD_ID.IMPOSSIBLE : cat.dup ? Number(form.dupUse ?? FIELD_ID.POSSIBLE) : FIELD_ID.POSSIBLE;
  let duplicateWinnerCount;
  let duplicateWinnerCountUseType;
  let duplicateCheckBaseValue;
  if (dupUse !== FIELD_ID.POSSIBLE) duplicateCheckBaseValue = FIELD_ID.ENTRY_DATA;
  if (dupUse === FIELD_ID.DUPCOUNTUSE) {
    if (cat.entryHasType && form.dupDetail === FIELD_ID.GROUPNONE) {
      duplicateWinnerCountUseType = FIELD_ID.GROUPNONE;
      duplicateCheckBaseValue = `${FIELD_ID.ENTRY_TYPE},${FIELD_ID.ENTRY_DATA}`;
    } else {
      duplicateWinnerCountUseType = cat.entryHasType ? FIELD_ID.GROUP : FIELD_ID.NOGROUP;
      duplicateWinnerCount = num(form.dupCount);
      if (!Number.isInteger(duplicateWinnerCount) || duplicateWinnerCount < 1) {
        err('dup', cat.entryHasType ? 'msg.input.dupCountGroup' : 'msg.input.dupCount');
      }
    }
  }

  // Result file
  if (!state.resultParsed) err('result', 'msg.file.result');
  else if (!state.resultParsed.rows || state.resultParsed.rows.length < 1) err('result', 'msg.input.resultEmpty');

  // Count consistency
  const mainCount = drawingCount > 0 ? drawingCount : sumWinCount(winSettingList);
  const prelimCount = prelim.use
    ? (prelim.method === PRELIMINARY_ORDER_TYPE.ALL.id ? prelim.count : sumWinCount(preliminaryList))
    : 0;
  if (isMass && state.manifest && mainCount + prelimCount > state.manifest.totalLines) {
    err('winSetting', 'msg.input.overTotalLines', { count: mainCount + prelimCount, total: state.manifest.totalLines });
  }
  // With companion assignment one person takes several tickets, so the check is against the total winnable count, not the number of entrants
  const available = cat.companion ? companionTotal : entryRows.length;
  if (isRangeEntry && luckyRange && mainCount > luckyRange.end - luckyRange.start + 1) {
    err('winSetting', 'msg.input.overLuckyRange', { count: mainCount, entry: luckyRange.end - luckyRange.start + 1 });
  }
  if (!isMass && entryRows.length > 0 && mainCount > available) {
    if (cat.companion) warn('winSetting', 'msg.input.overCompanion', { count: mainCount, available });
    else warn('winSetting', 'msg.input.overEntry', { count: mainCount, entry: entryRows.length });
  }

  if (errors.length > 0) return { errors, warnings, input: null, summary: null };

  const setting = {
    category: cat.id,
    randomAlgorithmType: algorithm,
    drawingCount,
    categoryInfo: { ...cat.categoryInfo },
    duplicateWinLimitUse: dupUse,
  };
  if (duplicateCheckBaseValue) setting.duplicateCheckBaseValue = duplicateCheckBaseValue;
  if (duplicateWinnerCountUseType) setting.duplicateWinnerCountUseType = duplicateWinnerCountUseType;
  if (duplicateWinnerCount != null) setting.duplicateWinnerCount = duplicateWinnerCount;
  if (cat.weight) {
    setting.weightDrawMethod = weightDrawMethod;
    setting.totalDrawingWeight = totalDrawingWeight;
  }
  if (cat.ball) setting.ballNumber = String(form.ballNumber).trim();
  if (isRangeEntry) {
    setting.startLuckyNumberRange = luckyRange.start;
    setting.endLuckyNumberRange = luckyRange.end;
  }
  if (lotteryWeightUse) {
    setting.lotteryNumberWeightUse = true;
    setting.lotteryStat = lotteryStat;
    setting.totalDrawingWeight = totalDrawingWeight;
  }
  // Result ordering of a lucky-number draw is an operator choice, so whatever the bundle carries is used as is.
  // ⚠ An empty string is a value too (draw order). Only an older bundle with no value at all falls back to the catalog default.
  if (cat.resultSort) {
    setting.drawingResultSort = form.drawingResultSort == null ? cat.resultSort : String(form.drawingResultSort);
  }
  // Lottery bonus number: used when the bundle carries it. Only older bundles without it let the engine infer it from the draw count.
  if (typeof form.lotteryBonusNumberUse === 'boolean') setting.lotteryBonusNumberUse = form.lotteryBonusNumberUse;
  if (prelim.use) {
    setting.preliminaryOrderDrawingUse = true;
    setting.preliminaryOrderDrawingMethod = prelim.method;
    if (prelim.method === PRELIMINARY_ORDER_TYPE.ALL.id) setting.preliminaryOrderDrawingCount = prelim.count;
  }
  // In a backup-order draw the main draw is the backup assignment, so only the method is passed on to fix the winner ordering (the all mode orders by sequence alone)
  if (prelimOrderMethod) setting.preliminaryOrderDrawingMethod = prelimOrderMethod;

  const input = {
    seed,
    isOfficialDraw: true,
    setting,
    entryList: entryRows,
    winSettingList,
    preliminaryList,
  };
  if (isMass) input.entryCount = state.manifest.totalLines;

  return {
    errors,
    warnings,
    input,
    summary: {
      entryCount: isMass ? state.manifest.totalLines : isRangeEntry ? luckyRange.end - luckyRange.start + 1 : entryRows.length,
      mainCount,
      prelimCount,
      prelimMethod: prelim.use ? prelim.method : null,
      resultRows: state.resultParsed.rows.length,
      // Where the weights came from: the verifier cannot check lottery weights themselves, so it names their source
      weightSource: lotteryWeightUse
        ? { kind: 'lotteryStat', from: str(form.lotteryNumberTrunStartNum), to: str(form.lotteryNumberTrunEndNum) }
        : null,
    },
  };
};
