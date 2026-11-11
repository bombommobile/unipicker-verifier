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

// Weighted draw — section method (draw and remove) and rank-key method (Efraimidis-Spirakis).

import { FIELD_ID } from '../../fieldId.js';
import {
  LOTTERY_WEIGHT_DRAW_METHOD,
  PRELIMINARY_ORDER_TYPE,
  PRESALE_PRELIMINARY_ORDER_ID,
  WEIGHT_DRAW_METHOD,
} from '../../constants.js';
import { groupEntriesByThousand, sortGroupWinSettingList, WIN_SETTING_ORDER } from '../grouping.js';
import { fisherYatesShuffle, weightKey } from '../../../core/drawAlgorithms.js';
import {
  assignSingleWinFields,
  assignWinnerCommon,
  assignWinnerEntryType,
  entryWeightOf,
  logDraw,
  notifyDraw,
  reserveGroupKeyOrder,
} from './shared.js';
import { sortWinnerList } from './sortWinners.js';

// ─────────────────────────────────────────────────────────────
// Weighted draw
// ─────────────────────────────────────────────────────────────
// The setting picks between two methods. Both are weight-proportional and without replacement, but the same
// seed gives different winners and a different amount of RNG spent.
//   'A' | 'B'. An empty value (an old setting, or nothing picked in the UI) and anything unrecognised fall
//   back to A, which is what the app did before the option existed.
// ⚠ A weighted lotto draw offers no choice in the UI and is always A, whatever the stored value says.
const getWeightedDrawMethod = (input) => {
  if (input.setting.lotteryNumberWeightUse) return LOTTERY_WEIGHT_DRAW_METHOD;
  const v = input.setting.weightDrawMethod;
  return v === WEIGHT_DRAW_METHOD.RANK ? WEIGHT_DRAW_METHOD.RANK : WEIGHT_DRAW_METHOD.SECTION;
};

// Method A — pick and remove (roulette wheel with a uniform point).
// 1) Entrants occupy as many slots as their weight in a cumulative section list (groupEntriesByThousand).
// 2) One uniform point in 1..totalWeight is drawn by rejection sampling (rand.nextInt) and the entrant whose
//    slot it lands on wins.
// 3) The winner is removed from the pool and the sections and total are pulled down, so nobody wins twice
//    and nothing has to be redrawn.
const drawByWeightSection = (input, rand, groupWinSettingList, groupEntryList, totalEntryWeight, entryType, labels, obs) => {
  const _winnerList = [];
  let winSettingListIndex = 0;

  do {
    const entryMatchedWinSettingList = groupWinSettingList.get(entryType).list;
    // Which subgroup is next (subgroup 1 -> 2 -> 3)
    if (winSettingListIndex > entryMatchedWinSettingList.length - 1) winSettingListIndex = 0;
    const winSetting = entryMatchedWinSettingList[winSettingListIndex];

    // The winning point: one uniform integer in 1..totalWeight, so the chance of winning is exactly
    // weight / total. (rand is Sha256Rand in a weighted draw, so it has nextInt.)
    const winnerStandardNumber = rand.nextInt(1, totalEntryWeight);
    logDraw(obs, `가중치 기준값 = [${winnerStandardNumber}] 잔여 가중치 총합 = [${totalEntryWeight}]`);

    // Find the section the point falls in
    let winnerGroupIndex = 0;
    for (let i = 0; i < groupEntryList.size; i++) {
      if (groupEntryList.get(i).totalWeight === 0) continue; // fully won already
      if (winnerStandardNumber >= groupEntryList.get(i).min && winnerStandardNumber <= groupEntryList.get(i).max) {
        winnerGroupIndex = i;
        break;
      }
    }

    // Running total inside that section — its starting value depends on where the section begins
    let accWeight = groupEntryList.get(winnerGroupIndex).min - 1;
    let winner = null;

    for (let i = 0; i < groupEntryList.get(winnerGroupIndex).list.length; i++) {
      const entry = groupEntryList.get(winnerGroupIndex).list[i];
      const weight = Number(entryWeightOf(entry));
      if (entry[FIELD_ID.IS_WINNER]) continue;

      if (accWeight < winnerStandardNumber) {
        accWeight += weight;
        if (accWeight >= winnerStandardNumber) {
          winner = entry;

          const winFields = assignWinnerCommon(input, winner, winSetting, labels);
          assignSingleWinFields(winner, winFields);
          assignWinnerEntryType(input, winner, winSetting, labels);

          logDraw(obs, `  → 당첨 = [${winner[FIELD_ID.ENTRY_DATA_ORIGINAL] != null ? winner[FIELD_ID.ENTRY_DATA_ORIGINAL] : winner[FIELD_ID.ENTRY_DATA]}] 가중치 = [${weight}] 누적 = [${accWeight}]`);
          _winnerList.push(winner);
          break;
        }
      }
    }

    // Guard: a uniform point in 1..total always lands on someone. An empty winner would mean the sections
    // and the total have drifted apart, and the removal below would loop forever, so it stops here instead.
    if (winner === null) {
      throw new Error(`[drawByWeightSection] no winner found (point=${winnerStandardNumber}, remaining total=${totalEntryWeight}, section=${winnerGroupIndex}).`);
    }

    // Remove the winner from the pool: their weight goes to zero and the sections are pulled down so the
    // cumulative ranges stay contiguous.
    //  - the winner's own section: only max and totalWeight shrink (min is where the section starts)
    //  - the sections after it: min and max both shrink by the same amount
    const winnerWeight = Number(entryWeightOf(winner));
    for (let i = winnerGroupIndex; i < groupEntryList.size; i++) {
      const group = groupEntryList.get(i);
      group.max -= winnerWeight;
      if (i === winnerGroupIndex) group.totalWeight -= winnerWeight;
      else group.min -= winnerWeight;
    }
    totalEntryWeight -= winnerWeight;

    if (winSetting[FIELD_ID.WIN_COUNT] === winSetting[FIELD_ID.WINNER_COUNT]) {
      entryMatchedWinSettingList.splice(winSettingListIndex, 1);
    } else {
      winSettingListIndex++;
    }

    if (entryMatchedWinSettingList.length <= 0) {
      groupWinSettingList.delete(entryType);
      break;
    }
    // Everyone has won
    if (totalEntryWeight === 0) break;
  } while (groupWinSettingList.size > 0);

  return _winnerList;
};

// Method B — rank key (Efraimidis-Spirakis).
// Every entrant is given one key, and the smallest keys win:
//   key_i = -ln(u_i) / weight_i,  u_i = rand.next() in [0,1)
// A larger weight makes the key smaller, so it moves forward. One pass of key assignment and one sort, with
// no collisions and no redraws — weight-proportional and without replacement, like method A, but a different
// winner set and a different amount of RNG for the same seed.
//
// What is pinned for replay:
//  - RNG order = the section order of groupEntryList (0,1,2,...) then the entrant order inside each section.
//  - The winner pass spends exactly one next() per entrant and stores the key on the entry. The backup pass
//    (isWinner=false) reuses those stored keys and spends nothing, so backups continue from the rank right
//    after the last winner.
//  - u=0 (top 53 bits zero, probability 2^-53) or weight<=0 gives key=+Infinity, which sorts last.
//  - Ties (all but impossible in floating point) are broken by the assignment order ord, so the sort is stable.
// ⚠ totalEntryWeight is unused here; the signature matches method A so the two are drop-in replacements.
const drawByWeightRankKey = (input, rand, groupWinSettingList, groupEntryList, totalEntryWeight, entryType, isWinner = true, labels) => {
  const _winnerList = [];
  // Where the winner pass stores each key for the backup pass to reuse
  const WEIGHT_KEY_B = 'weightKeyB';

  const keyedEntries = [];
  let ord = 0;
  for (let g = 0; g < groupEntryList.size; g++) {
    const group = groupEntryList.get(g);
    for (let i = 0; i < group.list.length; i++) {
      const entry = group.list[i];
      const weight = Number(entryWeightOf(entry));
      let key;
      if (isWinner) {
        const u = rand.next(); // [0,1)
        key = weightKey(u, weight);
        entry[WEIGHT_KEY_B] = key;
      } else {
        // Backup pass: reuse the stored key. On the normal path it is always there, because a backup pass
        // is only method B when the main draw was too.
        // ⚠ A missing key stops here instead of recomputing — recomputing would spend more randomness and
        //   quietly follow a different stream that no replay with the same seed can reproduce. Reaching this
        //   means the main draw did not run as method B, or the entrant object was swapped out.
        if (entry[WEIGHT_KEY_B] == null) {
          throw new Error(
            `drawByWeightRankKey: backup draw (method B) has no weight key (${WEIGHT_KEY_B}) for an entrant`
            + ` — the main draw did not run as method B, or the entrant object was replaced.`
            + ` (entryType=${entryType}, seq=${entry[FIELD_ID.SEQ]}, group=${g}, index in group=${i})`
          );
        }
        key = entry[WEIGHT_KEY_B];
      }
      keyedEntries.push({ entry, key, ord: ord++ });
    }
  }

  keyedEntries.sort((a, b) => a.key - b.key || a.ord - b.ord);

  // Hand out the subgroups in key order — the round-robin and the winner record are the same as method A
  let winSettingListIndex = 0;
  let pickIndex = 0;

  do {
    const entryMatchedWinSettingList = groupWinSettingList.get(entryType).list;
    if (winSettingListIndex > entryMatchedWinSettingList.length - 1) winSettingListIndex = 0;
    const winSetting = entryMatchedWinSettingList[winSettingListIndex];

    // Next winner: the first entrant in key order who has not won and still carries weight
    let winner = null;
    while (pickIndex < keyedEntries.length) {
      const cand = keyedEntries[pickIndex++].entry;
      if (cand[FIELD_ID.IS_WINNER]) continue;
      if (Number(entryWeightOf(cand)) <= 0) continue;
      winner = cand;
      break;
    }
    // Pool exhausted — the same ending as method A's totalEntryWeight === 0
    if (winner === null) break;

    const winFields = assignWinnerCommon(input, winner, winSetting, labels);
    assignSingleWinFields(winner, winFields);
    assignWinnerEntryType(input, winner, winSetting, labels);

    _winnerList.push(winner);

    if (winSetting[FIELD_ID.WIN_COUNT] === winSetting[FIELD_ID.WINNER_COUNT]) {
      entryMatchedWinSettingList.splice(winSettingListIndex, 1);
    } else {
      winSettingListIndex++;
    }
    if (entryMatchedWinSettingList.length <= 0) {
      groupWinSettingList.delete(entryType);
      break;
    }
  } while (groupWinSettingList.size > 0);

  return _winnerList;
};

// Weighted draw dispatcher — a pure branch on the setting, with no side effect of its own.
export const drawByWeight = (input, rand, groupWinSettingList, groupEntryList, totalEntryWeight, entryType, isWinner = true, labels, obs) =>
  getWeightedDrawMethod(input) === WEIGHT_DRAW_METHOD.RANK
    ? drawByWeightRankKey(input, rand, groupWinSettingList, groupEntryList, totalEntryWeight, entryType, isWinner, labels)
    : drawByWeightSection(input, rand, groupWinSettingList, groupEntryList, totalEntryWeight, entryType, labels, obs);

// Entrant order for a weighted draw. Always returns a new array (input.entryList is left alone).
//  - method A: Fisher-Yates shuffle of every entrant
//  - method B: no ordering at all — the key sort replaces it
//  - the backup pass skips the shuffle either way: method A is fair regardless of order, and skipping it
//    cuts the RNG spent from O(losers) to O(backups)
export const orderWeightDrawEntryList = (input, rand, entryList, isWinner = true) => {
  const isB = getWeightedDrawMethod(input) === WEIGHT_DRAW_METHOD.RANK;
  const skipShuffle = isB || !isWinner;
  const list = skipShuffle ? [...entryList] : fisherYatesShuffle(rand, [...entryList]);
  // Stamp the shuffle result so the detailed log can show what a replay was built on (no RNG — result unchanged)
  if (!skipShuffle) for (let i = 0; i < list.length; i++) list[i].shuffleOrder = i + 1;
  return list;
};

// Weighted draw. It is the base for the rank, gift and group-assignment categories.
// There is no per-type or re-win handling here — a winner reaches the win settings through FIELD_ID.NONE.
// The backup pass (isWinner=false) runs the same weighted logic over the loser pool; weighted categories
// force the one-pool backup method, so it stays a single weighted pool with no type branch.
export const weightDraw = (input, rand, out, isWinner = true, labels, obs) => {
  const winSettingList = isWinner ? input.winSettingList : input.preliminaryList;
  const entryList = isWinner ? input.entryList : out.loserList;
  const winSettingListByType = isWinner ? input.winSettingListByType : input.preliminaryListByType;
  const entryType = isWinner ? FIELD_ID.NONE : FIELD_ID.PRELIMINARY_ALL;

  // ⚠ Mutates out.winnerListByGroupKey in place — no reassignment here.
  reserveGroupKeyOrder(out.winnerListByGroupKey, winSettingListByType);

  const sortEntryList = orderWeightDrawEntryList(input, rand, entryList, isWinner);
  const groupEntryList = groupEntriesByThousand(sortEntryList);
  if (isWinner) notifyDraw(obs);

  // Win settings are shuffled rather than sorted on rid, because a weighted draw never assigns them one
  const shuffledWinSettingList = fisherYatesShuffle(rand, [...winSettingList]);
  const groupWinSettingList = sortGroupWinSettingList(shuffledWinSettingList, WIN_SETTING_ORDER.KEEP_INPUT_ORDER, out.sortOrderType);

  // Total weight: the stored setting value for winners, and for backups the last section's max, which is the
  // cumulative total groupEntriesByThousand just built — the same number drawByWeightSection works against.
  const totalEntryWeight = isWinner
    ? input.setting.totalDrawingWeight
    : groupEntryList.size > 0
    ? groupEntryList.get(groupEntryList.size - 1).max
    : 0;

  const _winnerList = drawByWeight(input, rand, groupWinSettingList, groupEntryList, totalEntryWeight, entryType, isWinner, labels, obs);

  const orderCategoryInfo = isWinner ? input.categoryInfo : { id: PRESALE_PRELIMINARY_ORDER_ID };
  const orderPreliminaryAll = input.setting.preliminaryOrderDrawingMethod === PRELIMINARY_ORDER_TYPE.ALL.id;
  const winnerList = sortWinnerList(_winnerList, orderCategoryInfo, orderPreliminaryAll, false, input);
  out.winnerList = out.winnerList.concat(winnerList);
};
