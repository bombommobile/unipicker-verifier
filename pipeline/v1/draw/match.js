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

// Match draw — pairs entrants off; a leftover entrant gets a bye.

import { FIELD_ID } from '../../fieldId.js';
import { sortByFields } from '../sort.js';
import { sortGroupedEntries } from '../grouping.js';
import { blocksRewin, notifyDraw } from './shared.js';
import { sortWinnerList } from './sortWinners.js';

// ─────────────────────────────────────────────────────────────
// Match draw
// ─────────────────────────────────────────────────────────────

// Walk the entrants in order and pair them up.
export const matchDraw = (input, out, obs) => {
  const sortEntryList = sortByFields([...input.entryList], out.sortOrderType, FIELD_ID.R_ID, FIELD_ID.SEQ);
  const sortEntryListCount = sortEntryList.length;
  const groupEntryList = sortGroupedEntries(sortEntryList);
  notifyDraw(obs);
  const _winnerList = [];

  for (let i = 0; i < sortEntryListCount; i++) {
    const entry = sortEntryList[i];
    const entryType = entry[FIELD_ID.ENTRY_TYPE];
    if (entry[FIELD_ID.IS_WINNER] === true) continue;

    // Re-win limit for this entrant — only looked at when the limit is on and a shared state exists.
    // ⚠ The app tested truthiness here and !== POSSIBLE on the opponent side below. Over 0/1/2 the two mean
    //   the same thing, so both use the one predicate now.
    const usesDupState = blocksRewin(input.setting) && entry.dupInfo !== null;
    if (usesDupState && entry.dupInfo.hasWonBefore) continue;
    if (usesDupState) entry.dupInfo.hasWonBefore = true;

    entry[FIELD_ID.IS_WINNER] = true;
    entry[FIELD_ID.IS_PRELIMINARY] = false;
    entry[FIELD_ID.WIN_ENTRY_TYPE] = entry[FIELD_ID.ENTRY_TYPE];
    entry[FIELD_ID.WIN_COUNT] = 1;

    if (groupEntryList.has(entryType)) {
      const entryInfo = groupEntryList.get(entryType);
      const entryList = entryInfo.list;
      let winOrderNo = entryInfo[FIELD_ID.WINNER_ORDER]++;
      entry[FIELD_ID.WINNER_ORDER] = winOrderNo;
      entry[FIELD_ID.WIN_ENTRY_GROUP] = `W${winOrderNo}`; // both sides of a pair share the group name
      entry[FIELD_ID.WIN_ENTRY_GROUP_SEQ] = winOrderNo;

      let matchEntryIndex = entryInfo[FIELD_ID.MATCH_ENTRY_INDEX];
      let isMatched = false;
      do {
        if (!entryList[matchEntryIndex]) break;
        if (entryList[matchEntryIndex][FIELD_ID.IS_WINNER] === true) {
          ++matchEntryIndex;
          continue;
        }
        const matchEntry = entryList[matchEntryIndex];

        const matchUsesDupState = blocksRewin(input.setting) && matchEntry.dupInfo !== null;
        if (matchUsesDupState && matchEntry.dupInfo.hasWonBefore) {
          ++matchEntryIndex;
          continue;
        }
        if (matchUsesDupState) matchEntry.dupInfo.hasWonBefore = true;

        matchEntry[FIELD_ID.IS_WINNER] = true;
        matchEntry[FIELD_ID.WIN_COUNT] = 1;
        matchEntry[FIELD_ID.IS_PRELIMINARY] = false;
        matchEntry[FIELD_ID.WIN_ENTRY_TYPE] = matchEntry[FIELD_ID.ENTRY_TYPE];
        matchEntry[FIELD_ID.WINNER_ORDER] = winOrderNo;
        matchEntry[FIELD_ID.WIN_ENTRY_GROUP] = `W${winOrderNo}`;
        matchEntry[FIELD_ID.WIN_ENTRY_GROUP_SEQ] = winOrderNo;
        _winnerList.push(matchEntry);

        entryInfo[FIELD_ID.MATCH_ENTRY_INDEX] = matchEntryIndex;
        isMatched = true;
      } while (!isMatched);
    } else {
      // No group to pair inside
      entry[FIELD_ID.WINNER_ORDER] = 0;
      entry[FIELD_ID.WIN_ENTRY_GROUP] = `W0`;
      entry[FIELD_ID.WIN_ENTRY_GROUP_SEQ] = 0;
    }

    _winnerList.push(entry);
  }

  const winnerList = sortWinnerList(_winnerList, null, null, true, input);
  out.winnerList = out.winnerList.concat(winnerList);
};
