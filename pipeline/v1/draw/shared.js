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

// Values and helpers every draw shares — observation, entrant accessors, re-win limits and winner records.
// ⚠ None of these consume randomness. Moving a call in or out of them changes nothing; changing what they write does.

import { FIELD_ID } from '../../fieldId.js';
import { PRESALE_PRELIMINARY_ORDER_ID } from '../../constants.js';
import { sortByFields } from '../sort.js';

// ─────────────────────────────────────────────────────────────
// Group key slot reservation — shared by the group, lucky-number, weighted and mass preparation stages
// ─────────────────────────────────────────────────────────────
// Sorts by group key up front and creates the empty buckets, so a group-key draw shows them in that order.
// ⚠ Mutates winnerListByGroupKey in place and returns the same reference, not a new one — the caller must
//   not reassign from the return value. Another reference to this map may depend on seeing the mutation.
export const reserveGroupKeyOrder = (winnerListByGroupKey, winSettingListByType) => {
  let isEntryTypeAll = false;
  for (const [entryType, list] of winSettingListByType) {
    if (entryType === FIELD_ID.PRELIMINARY_ALL) isEntryTypeAll = true;
    const groupKeySortList = sortByFields(list, 0, 'seq');
    for (const w of groupKeySortList) {
      if (!winnerListByGroupKey.get(w[FIELD_ID.GROUP_KEY])) winnerListByGroupKey.set(w[FIELD_ID.GROUP_KEY], []);
    }
  }
  return { winnerListByGroupKey, isEntryTypeAll };
};

// ─────────────────────────────────────────────────────────────
// Observation — takes no part in the draw
// ─────────────────────────────────────────────────────────────
// ⚠ obs is the last argument and may be left out. Leaving it out must not change a winner or an RNG draw.
export const notifyDraw = (obs) => {
  if (obs && typeof obs.onStage === 'function') obs.onStage('draw');
};
export const logDraw = (obs, line) => {
  if (obs && typeof obs.pushDrawLogs === 'function') obs.pushDrawLogs(line);
};

// ─────────────────────────────────────────────────────────────
// Entrant essential data — one slot, read three ways
// ─────────────────────────────────────────────────────────────
// ENTRY_ESSENTIAL_DATA holds a weight, a multi-win count or a drawn mass number depending on the draw.
// Naming the read is all this does — the stored key and value are untouched, and the Number() conversion
// stays with the caller, as in the app.
// ⚠ Not split by meaning — this one slot is a required entrant column, and its meaning for a given category
//   is fixed by the category catalog, so a category never has two meanings live at once. The catalog, the
//   bundle header map and the spreadsheet column all key off this one field; splitting it here alone would
//   break that grouping and drift from the app.
export const entryWeightOf = (entry) => entry[FIELD_ID.ENTRY_ESSENTIAL_DATA];
export const entryWinCountOf = (entry) => entry[FIELD_ID.ENTRY_ESSENTIAL_DATA];
export const drawnNumberOf = (entry) => entry[FIELD_ID.ENTRY_ESSENTIAL_DATA];

// ─────────────────────────────────────────────────────────────
// Re-win limit setting — asked by name instead of compared raw
// ─────────────────────────────────────────────────────────────
// duplicateWinLimitUse is one of POSSIBLE(0), IMPOSSIBLE(1) or DUPCOUNTUSE(2). Key and values are unchanged.
// ⚠ The app used a plain truthiness test in one place in the match draw. Over 0/1/2 that means the same as
//   !== POSSIBLE, so both spellings collapsed into this one predicate.
export const blocksRewin = (setting) => setting.duplicateWinLimitUse !== FIELD_ID.POSSIBLE;
export const limitsRewinCount = (setting) =>
  setting.duplicateWinLimitUse === FIELD_ID.DUPCOUNTUSE && setting.duplicateWinnerCountUseType === FIELD_ID.NOGROUP;
export const limitsRewinPerGroup = (setting) =>
  setting.duplicateWinLimitUse === FIELD_ID.DUPCOUNTUSE && setting.duplicateWinnerCountUseType === FIELD_ID.GROUP;

// ─────────────────────────────────────────────────────────────
// Shared re-win state — entrants with the same value share one
// ─────────────────────────────────────────────────────────────
// Entrants whose values match (by duplicateCheckBaseValue) share a single state object, so a win by any one
// of them is immediately visible to the rest. That sharing is what makes the re-win limit work.
// ⚠ Never copy it. A defensive copy hides one entrant's win from the others and the limit falls apart.
//   It holds these three fields only — the entrant's own data stays on the entry.

// The state one value group shares. These three fields are all of it.
const createSharedDupState = () => ({ hasWonBefore: false, dupWinnerCount: 0, dupWinnerGroup: [] });

// Let the next entrant see the same state as this one. ⚠ The same reference, not a copy of the value.
export const shareDupState = (entry, nextEntry) => {
  // If this entrant has none yet, it is created here.
  if (!entry.dupInfo) entry.dupInfo = createSharedDupState();
  nextEntry.dupInfo = entry.dupInfo;
};

// Does this entrant hold a shared state? Entrants with no duplicate do not.
export const hasSharedDupState = (entry) => entry.dupInfo !== undefined && entry.dupInfo !== null;

// Winner record 1: win order, counters and the fields every branch writes.
// ⚠ winner is mutated in place (no defensive copy) — the caller keeps using the same object and it ends up
//   in the result. The three winner-group values are only computed and returned; each branch assigns them
//   itself because the order and accumulation differ.
export const assignWinnerCommon = (input, winner, winSetting, labels) => {
  // Win order inside the subgroup (the counter was added as 0 when the list was sorted above)
  const winOrderNo = ++winSetting[FIELD_ID.WINNER_ORDER];

  // Winners assigned to this subgroup
  winSetting[FIELD_ID.WINNER_COUNT]++;

  winner[FIELD_ID.IS_WINNER] = true;
  winner[FIELD_ID.IS_PRELIMINARY] = winSetting[FIELD_ID.IS_PRELIMINARY] ? true : false;
  winner[FIELD_ID.WINNER_ORDER] = winOrderNo;

  // Winner group name
  const winEntryGroup =
    winSetting[FIELD_ID.ENTRY_GROUP] !== FIELD_ID.NONE
      ? winSetting[FIELD_ID.ENTRY_GROUP]
      : input.setting.category === PRESALE_PRELIMINARY_ORDER_ID || winSetting[FIELD_ID.IS_PRELIMINARY]
      ? `${labels.preliminary} ${winOrderNo}`
      : '';
  const winEntryGroupSeq = winSetting.seq || 0;
  const winGroupKey = winSetting[FIELD_ID.GROUP_KEY];

  return { winOrderNo, winEntryGroup, winEntryGroupSeq, winGroupKey };
};

// Winner record 2, single-win branch (weighted A and B): assign the winner-group fields.
// ⚠ The assignment order differs from the group branch below — each branch keeps the app's own order.
export const assignSingleWinFields = (winner, { winEntryGroup, winEntryGroupSeq, winGroupKey }) => {
  winner[FIELD_ID.WIN_ENTRY_GROUP] = winEntryGroup;
  winner[FIELD_ID.WIN_ENTRY_GROUP_SEQ] = winEntryGroupSeq;
  winner[FIELD_ID.GROUP_KEY] = winGroupKey;
  winner[FIELD_ID.WIN_COUNT] = 1;
};

// Winner record 2, group branch: assign the winner-group fields.
// With multi-win on, group names accumulate comma-separated and the first seq and group key are kept.
// ⚠ The assignment order differs from assignSingleWinFields — each branch keeps the app's own order.
export const assignGroupWinFields = (winner, useMultipleWinner, { winEntryGroup, winEntryGroupSeq, winGroupKey }) => {
  if (useMultipleWinner) {
    winner[FIELD_ID.WIN_COUNT] = (winner[FIELD_ID.WIN_COUNT] ? winner[FIELD_ID.WIN_COUNT] : 0) + 1;
    winner[FIELD_ID.WIN_ENTRY_GROUP] = (winner[FIELD_ID.WIN_ENTRY_GROUP] ? `${winner[FIELD_ID.WIN_ENTRY_GROUP]}, ` : '') + winEntryGroup;
    winner[FIELD_ID.WIN_ENTRY_GROUP_SEQ] = winner[FIELD_ID.WIN_ENTRY_GROUP_SEQ] ? winner[FIELD_ID.WIN_ENTRY_GROUP_SEQ] : winEntryGroupSeq;
    winner[FIELD_ID.GROUP_KEY] = winner[FIELD_ID.GROUP_KEY] ? winner[FIELD_ID.GROUP_KEY] : winGroupKey;
  } else {
    winner[FIELD_ID.WIN_COUNT] = 1;
    winner[FIELD_ID.WIN_ENTRY_GROUP] = winEntryGroup;
    winner[FIELD_ID.WIN_ENTRY_GROUP_SEQ] = winEntryGroupSeq;
    winner[FIELD_ID.GROUP_KEY] = winGroupKey;
  }
};

// Winner record 3: class and gift — every branch calls this right before pushing to the winner list.
export const assignWinnerEntryType = (input, winner, winSetting, labels) => {
  // A backup-order draw over one pool records the class as "all"
  if (winSetting[FIELD_ID.ENTRY_TYPE] === FIELD_ID.PRELIMINARY_ALL) winner[FIELD_ID.WIN_ENTRY_TYPE] = labels.all;
  else winner[FIELD_ID.WIN_ENTRY_TYPE] = winner[FIELD_ID.ENTRY_TYPE];

  // A gift draw carries the gift name from the win setting onto the winner
  if (input.categoryInfo.isGiftDraw) {
    if (winSetting[FIELD_ID.GIFT_NAME]) winner[FIELD_ID.GIFT_NAME] = winSetting[FIELD_ID.GIFT_NAME];
  }
};

// ─────────────────────────────────────────────────────────────
// Re-win limit — the verdict and the record are kept apart
// ─────────────────────────────────────────────────────────────
// dupLimit is what drawGroupWinners reads once from the setting:
//   { isUse, isCountTypeNoGroup, isCountTypeGroup }.

// Should this win be blocked? ⚠ Reads only — no side effect belongs here. The caller leaves at the same
// place the app's break was, and the record (recordDuplicateWin) only happens once the verdict lets it through.
export const isDuplicateWinBlocked = (input, winner, winSetting, entryType, dupLimit) => {
  // Limit by count, subgroups not separated
  if (dupLimit.isCountTypeNoGroup) {
    if (winSetting[FIELD_ID.ENTRY_GROUP] !== FIELD_ID.NONE && winner.dupInfo.dupWinnerGroup.includes(winSetting[FIELD_ID.ENTRY_GROUP])) return true; // this subgroup already won
    if (winner.dupInfo.dupWinnerCount >= input.setting.duplicateWinnerCount) return true; // the allowance is used up
    return false;
  }
  // Limit by count, per group
  if (dupLimit.isCountTypeGroup) {
    if (winner.dupInfo.dupWinnerGroup.includes(entryType)) return true; // this group already won
    if (winner.dupInfo.dupWinnerCount >= input.setting.duplicateWinnerCount) return true; // the allowance is used up
    return false;
  }
  // No count limit, or re-winning is not allowed at all
  return true;
};

// Record the re-win. ⚠ Only call this once the verdict has let the win through — it mutates dupInfo in place.
export const recordDuplicateWin = (winner, winSetting, entryType, dupLimit) => {
  winner.dupInfo.dupWinnerCount++;
  winner.dupInfo.hasWonBefore = true;

  if (winSetting[FIELD_ID.ENTRY_GROUP] !== FIELD_ID.NONE && dupLimit.isCountTypeNoGroup) {
    winner.dupInfo.dupWinnerGroup.push(winSetting[FIELD_ID.ENTRY_GROUP]); // subgroup name
  } else if (dupLimit.isCountTypeGroup) {
    // Group name. A backup draw over one pool has to win once regardless of the entrant's own group,
    // so the entryType being drawn is what gets stored.
    winner.dupInfo.dupWinnerGroup.push(entryType);
  }
};
