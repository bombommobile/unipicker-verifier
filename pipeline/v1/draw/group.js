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

// Group draw — the default path, and the one every other draw falls back to for assigning winners within a group.

import { FIELD_ID } from '../../fieldId.js';
import { PRELIMINARY_ORDER_TYPE, PRESALE_PRELIMINARY_ORDER_ID } from '../../constants.js';
import { sortByFields } from '../sort.js';
import { sortGroupWinSettingList, WIN_SETTING_ORDER } from '../grouping.js';
import {
  assignGroupWinFields,
  assignWinnerCommon,
  assignWinnerEntryType,
  blocksRewin,
  entryWinCountOf,
  hasSharedDupState,
  isDuplicateWinBlocked,
  limitsRewinCount,
  limitsRewinPerGroup,
  notifyDraw,
  recordDuplicateWin,
  reserveGroupKeyOrder,
} from './shared.js';
import { sortWinnerList } from './sortWinners.js';

// ─────────────────────────────────────────────────────────────
// Group draw
// ─────────────────────────────────────────────────────────────

// Walk the entrants in order and hand out the subgroups round-robin.
export const drawGroupWinners = (input, entryList, groupWinSettingList, isEntryTypeAll, labels) => {
  const winnerList = [];

  // Re-win limit — the verdict and the record both read this, so it is read once as one value.
  const dupLimit = {
    isUse: blocksRewin(input.setting),
    isCountTypeNoGroup: limitsRewinCount(input.setting),
    isCountTypeGroup: limitsRewinPerGroup(input.setting),
  };
  const useMultipleWinner = input.categoryInfo.useMultipleWinner;

  for (let i = 0; i < entryList.length; i++) {
    const entry = entryList[i];

    // How many wins this entrant needs. Only a multi-win category reads the count off the entrant.
    let winCount = useMultipleWinner ? Number(entryWinCountOf(entry) || 1) : 1;

    let isFirstWinProcessed = false;

    // Drawing over one pool pins every entrant to the ALL class
    const entryType = isEntryTypeAll ? FIELD_ID.PRELIMINARY_ALL : entry[FIELD_ID.ENTRY_TYPE];

    // No matching win-setting group means this entrant is skipped
    if (!groupWinSettingList.has(entryType)) continue;

    const entryMatchWinSetting = groupWinSettingList.get(entryType);

    // No subgroups left to draw from — drop the group from the map and move on
    const hasNoWinSetting = !(Array.isArray(entryMatchWinSetting.list) && entryMatchWinSetting.list.length > 0);
    if (hasNoWinSetting) {
      groupWinSettingList.delete(entryType);
      continue;
    }

    let winner = null;
    do {
      // Which subgroup is next (subgroup 1 -> 2 -> 3). A ball-number draw fills one subgroup at a time,
      // and a multi-win draw is excluded from advancing the index below.
      let index = entryMatchWinSetting.index;
      if (index > entryMatchWinSetting.list.length - 1) index = 0;

      const winSetting = entryMatchWinSetting.list[index];

      if (winSetting[FIELD_ID.WIN_COUNT] > winSetting[FIELD_ID.WINNER_COUNT]) {
        // First win of a multi-win entrant that needs more than this subgroup has left
        const isFirstWinOverRemaining = !isFirstWinProcessed && winCount > (winSetting[FIELD_ID.WIN_COUNT] - winSetting[FIELD_ID.WINNER_COUNT]);
        // Nowhere else to move it to, so this entrant loses altogether
        if (isFirstWinOverRemaining && entryMatchWinSetting.list.length < 2) break;

        winner = entry;

        if (dupLimit.isUse && hasSharedDupState(winner)) {
          const isAlreadyWinning = !isFirstWinProcessed && winner.dupInfo.hasWonBefore;
          // ⚠ This break is the exit. Moving the record below in front of it changes the result.
          if (isAlreadyWinning && isDuplicateWinBlocked(input, winner, winSetting, entryType, dupLimit)) break;

          recordDuplicateWin(winner, winSetting, entryType, dupLimit);
        }

        const { winEntryGroup, winEntryGroupSeq, winGroupKey } = assignWinnerCommon(input, winner, winSetting, labels);
        assignGroupWinFields(winner, useMultipleWinner, { winEntryGroup, winEntryGroupSeq, winGroupKey });
        assignWinnerEntryType(input, winner, winSetting, labels);

        // Each winner row carries its own winner-group values so the list can be sorted on them
        winnerList.push({
          ...winner,
          [FIELD_ID.WIN_ENTRY_GROUP_SEQ]: winEntryGroupSeq,
          [FIELD_ID.WIN_LIST_ENTRY_GROUP]: winEntryGroup,
          [FIELD_ID.GROUP_KEY]: winGroupKey,
        });

        isFirstWinProcessed = true;
        winCount--;

        // The subgroup is full — drop it
        if (winSetting[FIELD_ID.WIN_COUNT] === winSetting[FIELD_ID.WINNER_COUNT]) {
          entryMatchWinSetting.list.splice(index, 1);
        }
        // Otherwise move to the next subgroup, unless this category wins in order
        else if (!input.categoryInfo.isBallNumberInputDrawing && !useMultipleWinner) {
          entryMatchWinSetting.index = ++index;
        }
      } else {
        // Nothing left to win here — drop the subgroup
        entryMatchWinSetting.list.splice(index, 1);
      }

      // No subgroups left: drop the group from the map and leave
      // ⚠ Do not move where this delete happens — it decides whether the next entrant meets this group.
      const isGroupExhausted = entryMatchWinSetting.list.length < 1;
      if (isGroupExhausted) {
        groupWinSettingList.delete(entryType);
        break;
      }
    } while (winCount > 0);

    // Nothing left to draw for anyone
    if (groupWinSettingList.size < 1) break;
  }

  return winnerList;
};

// Group draw — sort the entrants and win settings, run the assignment, then sort and append the winners.
export const groupDraw = (input, out, isWinner, labels, obs) => {
  const winSettingList = isWinner ? input.winSettingList : input.preliminaryList;
  const entryList = isWinner ? input.entryList : out.loserList;
  const winSettingListByType = isWinner ? input.winSettingListByType : input.preliminaryListByType;

  // ⚠ Mutates out.winnerListByGroupKey in place — no reassignment here.
  const { isEntryTypeAll } = reserveGroupKeyOrder(out.winnerListByGroupKey, winSettingListByType);

  const isBallNumberInputDrawing = input.categoryInfo.isBallNumberInputDrawing;
  const useWinSettingOrderWinner = input.categoryInfo.useWinSettingOrderWinner;

  // A ball-number draw orders entrants by the second random number, everything else by the first
  const sortEntryList = sortByFields([...entryList], out.sortOrderType, isBallNumberInputDrawing ? FIELD_ID.DRAW_USE_R_ID : FIELD_ID.R_ID, FIELD_ID.SEQ);
  // A ball-number or in-order draw does not shuffle — fixed to input seq order
  const winSettingOrder = isBallNumberInputDrawing || useWinSettingOrderWinner
    ? WIN_SETTING_ORDER.SEQ_ASCENDING
    : WIN_SETTING_ORDER.SEED_DIRECTED_RANDOM;
  const groupWinSettingList = sortGroupWinSettingList(winSettingList, winSettingOrder, out.sortOrderType);
  if (isWinner) notifyDraw(obs);

  const _winnerList = drawGroupWinners(input, sortEntryList, groupWinSettingList, isEntryTypeAll, labels);

  const orderCategoryInfo = isWinner ? input.categoryInfo : { id: PRESALE_PRELIMINARY_ORDER_ID };
  const orderPreliminaryAll = input.setting.preliminaryOrderDrawingMethod === PRELIMINARY_ORDER_TYPE.ALL.id;
  // Winners and backup winners sort by different rules, so each is sorted before being appended
  const winnerList = sortWinnerList(_winnerList, orderCategoryInfo, orderPreliminaryAll, false, input);
  out.winnerList = out.winnerList.concat(winnerList);
};
