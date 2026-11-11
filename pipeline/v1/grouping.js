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

// Grouping of entrants and win settings, and the sorted grouping the draws run on — this is what pins the
// RNG consumption order to the app's.
// ⚠ Changing a sort key (rid, seq) or the grouping order changes the order winners are assigned in.

import { FIELD_ID } from '../fieldId.js';
import { sortByFields } from './sort.js';

// Group win settings by entrant type — a missing entryType or entryGroup becomes NONE, and every row gets a group key.
export const groupWinSettingsByType = (list, listByType) => {
  if (!listByType) listByType = new Map();
  const winSettingList = [];
  for (let i = 0; i < list.length; i++) {
    const entryType = list[i][FIELD_ID.ENTRY_TYPE] || FIELD_ID.NONE;
    const entryGroup = list[i][FIELD_ID.ENTRY_GROUP] || FIELD_ID.NONE;
    const groupKey = `${entryType}${FIELD_ID.GROUP_KEY_SEPARATOR}${entryGroup}`;
    const winSetting = { ...list[i], entryType, entryGroup, groupKey };
    if (!listByType.get(entryType)) listByType.set(entryType, []);
    listByType.get(entryType).push(winSetting);
    winSettingList.push(winSetting);
  }
  return winSettingList;
};

// Group entrants by type — values are kept as they are (no trimming, no masking) and a dupInfo slot is prepared.
export const groupEntriesByType = (list) => {
  const entryListByType = new Map();
  const entryList = [];
  for (let i = 0; i < list.length; i++) {
    const entryType = list[i][FIELD_ID.ENTRY_TYPE] || FIELD_ID.NONE;
    const entry = { ...list[i], entryType, dupInfo: null };
    entry[FIELD_ID.ENTRY_DATA_ORIGINAL] = entry[FIELD_ID.ENTRY_DATA];
    if (!entryListByType.get(entryType)) entryListByType.set(entryType, []);
    entryListByType.get(entryType).push(entry);
    entryList.push(entry);
  }
  return { entryList, entryListByType };
};

// Lucky-number entrants — one entrant per number in the configured range, built at draw time instead of read
// from a file. Consumes one rand.next() per number unless the draw is weighted, where order comes from the weights.
// ⚠ The number is both the entrant value and its seq, so the range decides how much of the RNG stream is spent here.
// @param {object} input draw input (setting carries the range and, for weighted lotto, lotteryStat)
// @param {object} rand RNG stream — one next() per number on the non-weighted path
// @param {string} [set] lotto generator set label — becomes the entryType so each set draws from its own pool
export const buildLuckyNumberEntries = (input, rand, set) => {
  const setting = input.setting;
  const list = [];
  const start = Number(setting.startLuckyNumberRange);
  const end = Number(setting.endLuckyNumberRange);

  // Weight per number, position = number. Only a lotto draw with weighting on carries it.
  let lotteryStat = [];
  if (input.categoryInfo.isLotteryNumberDrawing) {
    if (setting.lotteryNumberWeightUse) lotteryStat = setting.lotteryStat || [];
  }

  let entryType = FIELD_ID.NONE;
  if (input.categoryInfo.isLottoNumberGenerator) entryType = set;

  const isWeightedDraw = setting.lotteryNumberWeightUse || input.categoryInfo.drawingWeightUse;

  for (let i = start; i <= end; i++) {
    const rid = isWeightedDraw ? null : rand.next();
    const data = {
      [FIELD_ID.SEQ]: i,
      [FIELD_ID.ENTRY_TYPE]: entryType,
      [FIELD_ID.ENTRY_DATA]: i,
      [FIELD_ID.WIN_ENTRY_GROUP]: null,
      [FIELD_ID.WIN_ENTRY_GROUP_SEQ]: null,
      [FIELD_ID.WINNER_ORDER]: null,
      [FIELD_ID.IS_WINNER]: null,
      [FIELD_ID.IS_PRELIMINARY]: null,
      dupInfo: null,
      [FIELD_ID.R_ID]: rid,
      [FIELD_ID.ENTRY_DATA_ORIGINAL]: i,
    };
    if (lotteryStat && lotteryStat.length > 0) data[FIELD_ID.ENTRY_ESSENTIAL_DATA] = lotteryStat[i - 1];
    list.push(data);
  }

  return list;
};

// Win-setting sort spec — which branch, stated as a value.
// The comparison keys and direction are all a spec is; the caller picks the one it needs.
// ⚠ The three branches' keys and direction are a replay contract — changing a value breaks past draws.
//   Frozen (spec, each branch, and each keys array) so a caller can only read it.
export const WIN_SETTING_ORDER = Object.freeze({
  // Weighted draw — the list is already Fisher-Yates shuffled; keep that order (no re-sort).
  KEEP_INPUT_ORDER: Object.freeze({ keys: Object.freeze([]), direction: 'input' }),
  // Ball-number input, lotto generator, kindergarten — win in the order they were entered.
  SEQ_ASCENDING: Object.freeze({ keys: Object.freeze([FIELD_ID.SEQ]), direction: 'asc' }),
  // Everything else — sort by rid, direction set by the seed (sortOrderType).
  SEED_DIRECTED_RANDOM: Object.freeze({ keys: Object.freeze([FIELD_ID.R_ID, FIELD_ID.SEQ]), direction: 'seed' }),
});

// Sort win settings, then group them by entrant type.
// @param {object} order        a sort spec (one of WIN_SETTING_ORDER)
// @param {integer} sortOrderType ascending(0)/descending(1) — used only by SEED_DIRECTED_RANDOM
export const sortGroupWinSettingList = (list, order, sortOrderType = 0) => {
  // direction 'input' skips the sort entirely — the given order is the result.
  const sortList = order.direction === 'input'
    ? [...list]
    : sortByFields([...list], order.direction === 'seed' ? sortOrderType : 0, ...order.keys);
  const groupList = new Map();
  for (let i = 0; i < sortList.length; i++) {
    const info = sortList[i];
    const entryType = info[FIELD_ID.ENTRY_TYPE];
    info[FIELD_ID.WINNER_ORDER] = 0; // win order inside the subgroup
    info[FIELD_ID.WINNER_COUNT] = 0; // winners assigned so far
    if (!groupList.get(entryType)) groupList.set(entryType, { index: 0, list: [] });
    groupList.get(entryType).list.push(info);
  }
  return groupList;
};

// Group an already sorted entrant list by type (used by the match draw).
export const sortGroupedEntries = (sortList) => {
  const groupList = new Map();
  for (let i = 0; i < sortList.length; i++) {
    const info = sortList[i];
    const entryType = info[FIELD_ID.ENTRY_TYPE];
    if (!groupList.get(entryType)) groupList.set(entryType, { [FIELD_ID.WINNER_ORDER]: 0, [FIELD_ID.MATCH_ENTRY_INDEX]: 0, list: [] });
    groupList.get(entryType).list.push(info);
  }
  return groupList;
};

// Group an already sorted entrant list into cumulative weight sections of 1000 (min/max/totalWeight),
// which is what the section weighted draw picks from.
// ⚠ The weight is read straight from ENTRY_ESSENTIAL_DATA here; draw.js names that read entryWeightOf.
//   This module stays free of draw.js so the two do not import each other.
export const groupEntriesByThousand = (sortList) => {
  const sortListCount = sortList.length;
  const groupList = new Map();
  const groupListCount = Math.ceil(sortListCount / 1000);
  for (let i = 0; i < groupListCount; i++) groupList.set(i, { list: [], min: 0, max: 0, totalWeight: 0 });

  let pushList = [];
  let totalWeight = 0;
  let mapIndex = 0;
  for (let i = 0; i < sortListCount; i++) {
    const entry = sortList[i];
    // ⚠ Always true; kept as in the app source.
    if (pushList.length <= 1000) {
      totalWeight += Number(entry[FIELD_ID.ENTRY_ESSENTIAL_DATA]);
      pushList.push(entry);
      if (pushList.length === 1000 || i === sortListCount - 1) {
        groupList.get(mapIndex).list = pushList;
        groupList.get(mapIndex).totalWeight = totalWeight;
        if (mapIndex === 0) {
          groupList.get(mapIndex).min = 1;
          groupList.get(mapIndex).max = totalWeight;
        } else {
          groupList.get(mapIndex).min = groupList.get(mapIndex - 1).max + 1;
          groupList.get(mapIndex).max = groupList.get(mapIndex - 1).max + totalWeight;
        }
        pushList = [];
        totalWeight = 0;
        mapIndex++;
      }
    }
  }
  return groupList;
};

// Leading digits of a random number as an integer = floor(rand * 10^digits). A ball-number draw takes 10.
export const randToLeadingDigits = (rand, digits) => Math.floor(rand * Math.pow(10, digits));

// One verification log line (NONE fields dropped).
export const joinLogFields = (datas) => datas.filter((d) => d !== FIELD_ID.NONE).join(FIELD_ID.GROUP_KEY_SEPARATOR);

// Match draw: group the winners by entryType, then by winner group — each group holds one pair.
export const groupWinnersByPair = (winnerList) => {
  const matchList = {};
  for (const winner of winnerList) {
    const entryType = winner[FIELD_ID.ENTRY_TYPE];
    const entryGroup = winner[FIELD_ID.WIN_ENTRY_GROUP];
    if (!matchList[entryType]) matchList[entryType] = {};
    if (!matchList[entryType][entryGroup]) matchList[entryType][entryGroup] = [];
    matchList[entryType][entryGroup].push(winner);
  }
  return matchList;
};

// Match draw: order the group keys by name.
export const orderGroupKeys = (list) => {
  const orderKeys = sortByFields(Object.keys(list), 0);
  const _list = {};
  for (const key of orderKeys) _list[key] = list[key];
  return _list;
};

// One result row per pair — the first of the pair carries the second's data in the opponent columns.
// A bye (a group of one) leaves those columns empty.
const pushPairedWinnerRow = (list, matchList, entryType, winnerEntryGroup) => {
  const group = matchList[entryType][winnerEntryGroup];
  list.push({
    ...group[0],
    [FIELD_ID.MATCH_ENTRY_DATA]: group[1] ? group[1][FIELD_ID.ENTRY_DATA] : '',
    [FIELD_ID.MATCH_ENTRY_DATA_ORIGINAL]: group[1] ? group[1][FIELD_ID.ENTRY_DATA_ORIGINAL] : '',
  });
};

// Match draw: flatten the grouped pairs into a single list of rows.
export const flattenPairsToRows = (matchList) => {
  const list = [];
  for (const entryType of Object.keys(matchList)) {
    for (const winnerEntryGroup of Object.keys(matchList[entryType])) {
      pushPairedWinnerRow(list, matchList, entryType, winnerEntryGroup);
    }
  }
  return list;
};
