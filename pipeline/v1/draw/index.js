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

// The preparation and draw stages of pipeline v1 — the same RNG consumption order as the app.
// ⚠ If a single stage consumes one more or one fewer random number than the app did, the result changes.
//   Do not change the logic in this folder.
//
// Draw functions take explicit arguments instead of one draw-wide object, and the position says what a thing is:
//   input  — the draw material: setting, categoryInfo, entrant and win-setting lists, counts.
//            ⚠ Not read-only. Three places mutate it in place:
//             1) preparation swaps entryList wholesale (a lucky-number draw builds fresh entrants);
//             2) preparation stamps a rid onto each entrant and win setting — the sort key that decides
//                the result;
//             3) a winner record mutates the entrant (won flag, win order, win group, class, dupInfo) and
//                the win setting (winnerOrder, winnerCount) in place (see shared.js).
//            A win setting spliced out once exhausted comes from a grouped copy, so input's own list length
//            is unchanged.
//   rand   — the RNG stream. Only the draws that consume randomness take it.
//   out    — what the draw accumulates: winnerList, loserList, loserListByType, winnerListByGroupKey, sortOrderType
//   labels — the backup-winner and "all" wording used to build group and class names. Injected by the caller so
//            this module never reaches for a locale of its own.
//   obs    — observation only: pushDrawLogs, onStage. Optional, and never part of the result.
//
// One file per draw, matching how the app splits the same code, so a change on one side has one place to land
// on the other. Nothing here re-exports across that boundary: the files below depend only on shared.js,
// sortWinners.js and each other, in that order.

export { sortWinnerList } from './sortWinners.js';
export { drawGroupWinners, groupDraw } from './group.js';
export { matchDraw } from './match.js';
export { drawByWeight, orderWeightDrawEntryList, weightDraw } from './weight.js';
export { luckyNumberDraw, orderLotteryResultList } from './luckyNumber.js';
export { massDraw } from './mass.js';
export { addEntryDuplicate, getLoserList } from './prepare.js';
