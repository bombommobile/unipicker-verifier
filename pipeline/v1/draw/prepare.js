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

// Preparation — duplicate marking and the loser list. Runs either side of the draw itself.

import { FIELD_ID } from '../../fieldId.js';
import { sortByFields } from '../sort.js';
import { shareDupState } from './shared.js';

// ─────────────────────────────────────────────────────────────
// Preparation
// ─────────────────────────────────────────────────────────────

// Give duplicate entrants their shared re-win state. Sorting by the duplicate base value puts equal values
// next to each other, so linking neighbours hands the whole value group one shared object. Consumes no RNG.
export const addEntryDuplicate = (entryList, duplicateCheckBaseValue) => {
  // Entrant data is compared on the original value, before any masking
  const duplicateCheckBaseValueList = duplicateCheckBaseValue.split(',').map((v) => (v === FIELD_ID.ENTRY_DATA ? FIELD_ID.ENTRY_DATA_ORIGINAL : v));
  const duplicateCheckBaseValueCount = duplicateCheckBaseValueList.length;
  sortByFields(entryList, 0, ...duplicateCheckBaseValueList);
  const entryListCount = entryList.length;

  let nextEntry;
  for (const [index, entry] of entryList.entries()) {
    if (index < entryListCount - 1) {
      nextEntry = entryList[index + 1];
      // Every base field is compared together, not the entrant data alone
      const checkEntryValue = [];
      const checkNextEntryValue = [];
      for (let d = 0; d < duplicateCheckBaseValueCount; d++) {
        checkEntryValue.push(entry[duplicateCheckBaseValueList[d]]);
        checkNextEntryValue.push(nextEntry[duplicateCheckBaseValueList[d]]);
      }
      const isDup = checkEntryValue.join('-') === checkNextEntryValue.join('-');
      if (isDup === true) shareDupState(entry, nextEntry);
    }
  }

  // Back to the input order
  sortByFields(entryList, 0, 'seq');
};

// The losers, which is the pool a backup-winner draw runs on.
export const getLoserList = (input, out) => {
  const loserListByType = out.loserListByType || new Map();
  out.loserList = input.entryList.reduce((acc, cur) => {
    if (!cur[FIELD_ID.IS_WINNER]) {
      if (!loserListByType.get(cur[FIELD_ID.ENTRY_TYPE])) loserListByType.set(cur[FIELD_ID.ENTRY_TYPE], []);
      loserListByType.get(cur[FIELD_ID.ENTRY_TYPE]).push(cur);
      acc.push(cur);
    }
    return acc;
  }, []);
  out.loserListByType = loserListByType;
};
