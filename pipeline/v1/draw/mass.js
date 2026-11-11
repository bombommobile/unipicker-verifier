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

// Mass-entrant draw — entrants arrive as bulk lines, so a winner is a line number until identity is filled in.

import { FIELD_ID } from '../../fieldId.js';
import { PRELIMINARY_ORDER_TYPE, PRESALE_PRELIMINARY_ORDER_ID } from '../../constants.js';
import { sortByFields } from '../sort.js';
import { sortGroupWinSettingList, WIN_SETTING_ORDER } from '../grouping.js';
import { floydSample } from '../../../core/drawAlgorithms.js';
import { drawGroupWinners } from './group.js';
import { drawnNumberOf, logDraw, notifyDraw, reserveGroupKeyOrder } from './shared.js';
import { sortWinnerList } from './sortWinners.js';

// ─────────────────────────────────────────────────────────────
// Mass-entrant draw
// ─────────────────────────────────────────────────────────────

// Wrap the numbers Floyd sampling picked into the entry objects the rest of the logic expects.
const sampleWithoutReplacement = (rand, obs, N, k) => {
  const winners = floydSample(rand, N, k, ({ t, picked, collision, log }) => {
    log.push(`당첨번호 = [${t}]`);
    if (collision) log.push(`중복처리 = [${picked}]`);
    logDraw(obs, log.join(' '));
  });
  return winners.map((picked, index) => ({
    [FIELD_ID.ORIGIN_SORT_NO]: index,
    [FIELD_ID.ENTRY_TYPE]: FIELD_ID.NONE,
    [FIELD_ID.ENTRY_ESSENTIAL_DATA]: picked,
  }));
};

// Hand the drawn numbers out over the subgroups — the same assignment the group draw uses.
const drawMassWinners = (input, out, winRandLines, isWinner, labels) => {
  const winSettingList = isWinner ? input.winSettingList : input.preliminaryList;
  const winSettingListByType = isWinner ? input.winSettingListByType : input.preliminaryListByType;
  // ⚠ Mutates out.winnerListByGroupKey in place — no reassignment here.
  const { isEntryTypeAll } = reserveGroupKeyOrder(out.winnerListByGroupKey, winSettingListByType);

  const useWinSettingOrderWinner = input.categoryInfo.useWinSettingOrderWinner;
  // An in-order draw does not shuffle — fixed to input seq order
  const winSettingOrder = useWinSettingOrderWinner ? WIN_SETTING_ORDER.SEQ_ASCENDING : WIN_SETTING_ORDER.SEED_DIRECTED_RANDOM;
  const groupWinSettingList = sortGroupWinSettingList(winSettingList, winSettingOrder, out.sortOrderType);

  const _winnerList = drawGroupWinners(input, winRandLines, groupWinSettingList, isEntryTypeAll, labels);

  const orderCategoryInfo = isWinner ? input.categoryInfo : { id: PRESALE_PRELIMINARY_ORDER_ID };
  const orderPreliminaryAll = input.setting.preliminaryOrderDrawingMethod === PRELIMINARY_ORDER_TYPE.ALL.id;
  const winnerList = sortWinnerList(_winnerList, orderCategoryInfo, orderPreliminaryAll, false, input);
  out.winnerList = out.winnerList.concat(winnerList);
};

// Mass-entrant draw — draw as many numbers as winners plus backups, then slice: the first part becomes the
// winners and the rest, if backups are drawn at all, becomes the backup winners.
export const massDraw = (input, rand, out, entryCount, labels, obs) => {
  const winSettingCount = input.winSettingCount;
  const winSettingTotalCount = input.winSettingTotalCount;

  notifyDraw(obs);
  const winRandLines = sampleWithoutReplacement(rand, obs, entryCount, winSettingTotalCount);

  let sortWinLines = winRandLines;
  if (input.categoryInfo.isMassDrawAddRandSort) {
    // Give the drawn numbers a rid and sort them the way the ordinary path does
    for (const info of winRandLines) info[FIELD_ID.R_ID] = rand.next();
    sortWinLines = sortByFields([...winRandLines], out.sortOrderType, FIELD_ID.R_ID, FIELD_ID.ORIGIN_SORT_NO);
    logDraw(obs, `당첨번호 난수 정렬 리스트 정렬 타입 = [${out.sortOrderType === 0 ? '오름차순' : '내림차순'}]`);
    if (input.categoryInfo.rankUse) {
      for (let l = 0; l < sortWinLines.length; l++) {
        const sortWin = sortWinLines[l];
        logDraw(obs, `당첨번호 = [${drawnNumberOf(sortWin)}] 정렬난수 = [${sortWin[FIELD_ID.R_ID]}] No = [${sortWin[FIELD_ID.ORIGIN_SORT_NO]}]`);
      }
    }
  }

  drawMassWinners(input, out, sortWinLines.slice(0, winSettingCount), true, labels);

  if (input.categoryInfo.preliminaryPossible && input.setting.preliminaryOrderDrawingUse === true) {
    drawMassWinners(input, out, sortWinLines.slice(winSettingCount), false, labels);
  }
};
