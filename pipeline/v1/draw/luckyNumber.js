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

// Lotto number generator — entrants are the numbers in the configured range, built at draw time.

import { FIELD_ID } from '../../fieldId.js';
import { LOTTERY_NUMBER_SETTING } from '../../constants.js';
import { sortByFields } from '../sort.js';
import { groupEntriesByThousand, sortGroupWinSettingList, WIN_SETTING_ORDER } from '../grouping.js';
import { drawGroupWinners } from './group.js';
import { notifyDraw, reserveGroupKeyOrder } from './shared.js';
import { assignDrawOrder } from './sortWinners.js';
import { drawByWeight, orderWeightDrawEntryList } from './weight.js';

// ─────────────────────────────────────────────────────────────
// Lotto number generator
// ─────────────────────────────────────────────────────────────

// Cap on how many times one set is redrawn.
// ⚠ Unreached under normal settings (6 of 45 lotto numbers is 8.14M combinations). A narrow number range
//   with many sets can exhaust the combinations, at which point duplicates are not allowed through and the
//   draw stops instead — so "sets never repeat" never quietly becomes conditional.
export const LUCKY_NUMBER_SET_RETRY_LIMIT = 1000;

// Distinct combinations available — diagnostic only, to say why the pool ran out at the cap.
// ⚠ Takes no part in the draw. Returns null (and is left out of the message) when it cannot be counted.
const combinationCount = (n, k) => {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n) return null;
  let count = 1;
  for (let i = 0; i < k; i++) count = (count * (n - i)) / (i + 1);
  return Number.isFinite(count) ? Math.round(count) : null;
};

// Draw one set — building its entrants through assigning draw order is one unit.
// Writes nothing to out; returns values only. Whether to keep the set (duplicate check) and whether to
// undo it are the caller's call.
// ⚠ groupWinSettingList is mutated in place by drawGroupWinners/drawByWeight as they spend win counts.
//   Undoing that mutation when a set turns out to be a duplicate is also the caller's job.
const drawLuckyNumberSet = (input, rand, labels, obs, groupWinSettingList, set, sortOrderType) => {
  const isWeightDraw = input.setting.lotteryNumberWeightUse;

  // Lucky-number entrants come from a number range, not a file, built fresh per set (consumes randomness here).
  const entryList = input.luckyNumberEntries(set);
  let winnerList = [];

  const sortEntryList = isWeightDraw
    ? orderWeightDrawEntryList(input, rand, entryList)
    : sortByFields([...entryList], sortOrderType, FIELD_ID.R_ID, FIELD_ID.SEQ);

  if (isWeightDraw) {
    const groupEntryList = groupEntriesByThousand(sortEntryList);
    const totalEntryWeight = input.setting.totalDrawingWeight;
    winnerList = drawByWeight(input, rand, groupWinSettingList, groupEntryList, totalEntryWeight, set, true, labels, obs);
  } else {
    winnerList = drawGroupWinners(input, sortEntryList, groupWinSettingList, undefined, labels);
  }

  const sortWinners = sortByFields([...winnerList], 0, FIELD_ID.SEQ);
  assignDrawOrder(sortWinners);

  // Winning numbers only, for the duplicate-set check
  const winnerNumber = [];
  for (let i = 0; i < sortWinners.length; i++) winnerNumber.push(sortWinners[i][FIELD_ID.ENTRY_DATA]);

  return { winnerList: sortWinners, winnerNumberKey: winnerNumber.toString() };
};

// What ran out when the cap was hit — number range, winners per set, possible combinations, sets settled.
const setRetryLimitError = (input, set, winnerCount, settledCount, totalSetCount) => {
  const start = Number(input.setting.startLuckyNumberRange);
  const end = Number(input.setting.endLuckyNumberRange);
  const total = combinationCount(end - start + 1, winnerCount);

  const detail = [
    `range=${start}~${end}`,
    `winners per set=${winnerCount}`,
    total === null ? null : `possible combinations=${total}`,
    `settled sets=${settledCount}/${totalSetCount}`,
  ].filter(Boolean).join(', ');

  return new Error(
    `[luckyNumberDraw] redrew ${set} ${LUCKY_NUMBER_SET_RETRY_LIMIT} times without finding a combination that`
    + ` does not repeat an earlier set (${detail}). Widen the number range or reduce the set count.`
  );
};

// One set at a time, each drawn from its own freshly generated pool of numbers.
// A set whose numbers repeat an earlier set is thrown away and redrawn, so the RNG stream keeps running
// while the winSetting rows for that set are put back from the copy taken before the attempt.
// ⚠ Set order is the input order (seq), not the seed's sort direction — sets are numbered, not shuffled.
// input.luckyNumberEntries builds the entrants for a set; the numbers come from a range, not a file, and
// building them consumes randomness, so a redraw spends more than one set's worth.
export const luckyNumberDraw = (input, rand, out, labels, obs) => {
  const winSettingList = input.winSettingList;

  // ⚠ Mutates out.winnerListByGroupKey in place — no reassignment here.
  reserveGroupKeyOrder(out.winnerListByGroupKey, input.winSettingListByType);

  // Ordered by input seq, so set 1 -> set 2 -> set 3
  const groupWinSettingList = sortGroupWinSettingList(winSettingList, WIN_SETTING_ORDER.SEQ_ASCENDING, out.sortOrderType);
  notifyDraw(obs);

  let setCount = 0;
  const setList = [...groupWinSettingList.keys()];
  const totalWinnerList = new Map();
  // The winning numbers of each accepted set, as strings, for the duplicate check
  const compare = [];
  // How many times the current set has been redrawn — resets to 0 whenever a set is settled
  let retryCount = 0;

  do {
    const set = setList[setCount];

    // Kept so the set's win settings can be put back if this attempt turns out to be a duplicate
    const copyValue = JSON.parse(JSON.stringify(groupWinSettingList.get(set)));

    const { winnerList, winnerNumberKey } = drawLuckyNumberSet(input, rand, labels, obs, groupWinSettingList, set, out.sortOrderType);

    const dupCheck = compare.indexOf(winnerNumberKey) > -1;

    if (!dupCheck) {
      totalWinnerList.set(set, winnerList);
      compare.push(winnerNumberKey);
      out.winnerList = out.winnerList.concat(winnerList);
      setCount++;
      retryCount = 0;
    } else {
      groupWinSettingList.set(set, copyValue);

      retryCount++;
      if (retryCount >= LUCKY_NUMBER_SET_RETRY_LIMIT) {
        throw setRetryLimitError(input, set, winnerList.length, compare.length, winSettingList.length);
      }
    }
  } while (setCount < winSettingList.length);
};

// Lotto result presentation order — the last thing that touches a lotto draw's winner list before the app
// writes the result file. It is not a draw step: the numbers and the bonus are already decided, and nothing
// here consumes randomness. But the app's file is written from that list, so a replay has to end up with the
// same rows in the same places or an identical draw reads as a mismatch.
// The rule is "everything but the bonus number ascending, bonus last".
// ⚠ The lotto generator never reaches this — its result file is written per set, one row per set.
// ⚠ Whether a bonus number was drawn is the bundle's to say. Bundles written before that field existed do not
//   carry it, and only those fall back to reading the draw count — the app wrote that count from this one option
//   and nothing else (BONUS_USE with it, DEFAULT_NUM without), so it is the best the old shape allows.
export const orderLotteryResultList = (input, out) => {
  const list = out.winnerList;
  const declared = input.setting.lotteryBonusNumberUse;
  const usesBonus =
    typeof declared === 'boolean' ? declared : Number(input.setting.drawingCount) === LOTTERY_NUMBER_SETTING.BONUS_USE;
  const bonus = usesBonus ? list[list.length - 1] : null;
  const ordered = sortByFields(usesBonus ? list.slice(0, list.length - 1) : [...list], 0, FIELD_ID.SEQ);
  if (bonus) ordered.push(bonus);
  out.winnerList = ordered;
};
