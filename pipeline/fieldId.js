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

// The app's field keys, ported as they are, so a replay meets the app's data on the same keys.
//
// The three random values, and how they relate — only a ball-number draw uses all three.
//   R_ID(rid)                 first random number, one per entrant from the RNG
//                             (a ball-number draw stores its leading 10 digits as an integer instead).
//   DRAW_R_ID(drawRid)        second random number = rid x ball number. An intermediate, never sorted on.
//   DRAW_USE_R_ID(drawUseRid) the actual sort key = the last 8 digits of drawRid. A ball-number draw
//                             orders its entrants by this value.
//
// ⚠ A key name is what the code calls the field; the value (a string) is what the app stored in its
//   database and result bundles. Changing a value breaks sorting, group keys and winner records —
//   keep every value byte-identical to the app.

export const FIELD_ID = {
  ID: 'id',
  SEQ: 'seq',
  R_ID: 'rid',
  DRAW_R_ID: 'drawRid',
  DRAW_USE_R_ID: 'drawUseRid',
  BALL_NUMBER: 'ballNumber',
  NUMBER: 'number',
  DRAW_ORDER: 'drawOrder',
  ENTRY_TYPE: 'entryType',
  ENTRY_GROUP: 'entryGroup',
  WIN_COUNT: 'winCount',
  ENTRY_DATA: 'entryData',
  ENTRY_ESSENTIAL_DATA: 'entryEssentialData',
  ENTRY_DATA_ORIGINAL: 'entryDataOriginal',
  WINNER_ORDER: 'winnerOrder',
  WIN_ENTRY_TYPE: 'winnerEntryType',
  WIN_ENTRY_GROUP: 'winnerEntryGroup',
  WIN_ENTRY_GROUP_SEQ: 'winnerEntryGroupSeq',
  WIN_LIST_ENTRY_GROUP: 'winnerListEntryGroup',
  MATCH_ENTRY_DATA: 'matchEntryData',
  MATCH_ENTRY_DATA_ORIGINAL: 'matchEntryDataOriginal',
  IS_WINNER: 'isWinner',
  IS_PRELIMINARY: 'isPreliminary',
  IS_CANCELLED: 'isCancelled',
  IS_LOSER: 'isLoser',
  IS_EXCLUDED: 'isExcluded',
  GROUP_KEY: 'groupKey',
  PRELIMINARY_ALL: 'UNI_PKR_PRELIMINARY_ALL',
  ALL: 'ALL',
  NONE: 'UNI_PKR_NONE',
  PRELIMINARY: 'PRELIMINARY',
  GROUP_KEY_SEPARATOR: '^',
  MATCH_ENTRY_INDEX: 'matchEntryIndex',
  WINNER_COUNT: 'winnerCount',
  ORIGIN: 'origin',
  MARKED: 'marked',
  POSSIBLE: 0,
  IMPOSSIBLE: 1,
  DUPCOUNTUSE: 2,
  NOGROUP: 'NOGROUP',
  GROUP: 'GROUP',
  GROUPNONE: 'GROUPNONE',
  GIFT_NAME: 'giftName',
  RANK: 'rank',
  ORIGIN_SORT_NO: 'originSortNo',
};

export default FIELD_ID;
