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

// Winner ordering — decides the row order the result file is written in, after the draw has already picked winners.
// ⚠ Who wins is settled before this runs. Only the order of the rows is decided here.

import { FIELD_ID } from '../../fieldId.js';
import { DRAWING_RESULT_SORT, LUCKY_NUMBER_RANK_ID, PRESALE_PRELIMINARY_ORDER_ID } from '../../constants.js';
import { sortByFields } from '../sort.js';
import { flattenPairsToRows, groupWinnersByPair, orderGroupKeys } from '../grouping.js';

// ─────────────────────────────────────────────────────────────
// Winner ordering
// ─────────────────────────────────────────────────────────────

// Number the winners 1..n inside each group key, in the order they now sit (no RNG).
export const assignDrawOrder = (list) => {
  let drawOrder = 1;
  let drawOrderGroup = '';
  for (let i = 0; i < list.length; i++) {
    if (drawOrderGroup !== list[i][FIELD_ID.GROUP_KEY]) {
      drawOrderGroup = list[i][FIELD_ID.GROUP_KEY];
      drawOrder = 1;
    }
    list[i][FIELD_ID.DRAW_ORDER] = drawOrder;
    list[i][FIELD_ID.WINNER_ORDER] = drawOrder;
    drawOrder += 1;
  }
};

// Winner ordering — match draws, then lucky-number draws, then everything else.
// ⚠ input carries the result-sort choice and the category id; both only matter on the lucky-number branch.
export const sortWinnerList = (winnerList, categoryInfo, preliminaryOrderAll, matchUse, input) => {
  if (matchUse) {
    const matchList = groupWinnersByPair(winnerList);
    const orderMatchList = orderGroupKeys(matchList);
    return flattenPairsToRows(orderMatchList);
  }

  // Lucky-number draws order by the operator's result-sort choice, then renumber the draw order inside each group.
  // ⚠ Ranked lucky-number draws keep the numbers they were drawn with — renumbering them would overwrite the rank order.
  if (categoryInfo && categoryInfo.isLuckyNumberDrawing) {
    const sortType = input.resultSort;
    let orderType = 0;
    const args = [FIELD_ID.WIN_ENTRY_GROUP_SEQ];
    if (sortType === DRAWING_RESULT_SORT.ASC) args.push(FIELD_ID.SEQ);
    else if (sortType === DRAWING_RESULT_SORT.DESC) {
      orderType = 1;
      args.push(FIELD_ID.SEQ);
    } else args.push(FIELD_ID.WINNER_ORDER);

    const sortedList = sortByFields([...winnerList], orderType, ...args);
    if (input.setting.category !== LUCKY_NUMBER_RANK_ID) assignDrawOrder(sortedList);
    return sortedList;
  }

  // A backup-order draw over one pool sorts on the win order alone; everything else sorts by the win-setting
  // input order first.
  const wList = [...winnerList];
  const args =
    (categoryInfo && categoryInfo.id === PRESALE_PRELIMINARY_ORDER_ID && preliminaryOrderAll) === true
      ? [FIELD_ID.WINNER_ORDER]
      : [FIELD_ID.WIN_ENTRY_GROUP_SEQ, FIELD_ID.WINNER_ORDER];
  return sortByFields(wList, 0, ...args);
};
