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

// The app enumerations and labels the draw logic reads, ported as they are.

// Weighted draw method (weightDrawMethod): A = section (pick-and-remove), B = rank key
export const WEIGHT_DRAW_METHOD = { SECTION: 'A', RANK: 'B' };

// A weighted lotto draw offers no choice — it is always the section method (A)
export const LOTTERY_WEIGHT_DRAW_METHOD = WEIGHT_DRAW_METHOD.SECTION;

// Backup-winner draw method: TYPE = per group, ALL = one pool
export const PRELIMINARY_ORDER_TYPE = { TYPE: { id: 'TYPE' }, ALL: { id: 'ALL' } };

// Category id of the backup-order draw (all) — decides both a winner group name and a sort branch
export const PRESALE_PRELIMINARY_ORDER_ID = 'PRESALE_PRELIMINARY_ORDER';

// Lucky-number result ordering (oper.drawingResultSort). The operator picks it, the bundle does not carry it,
// so domain/categories.js keeps the app default per category.
export const DRAWING_RESULT_SORT = { ASC: 'ASC', DESC: 'DESC', DRAW: 'DRAW' };

// Ranked lucky-number draw id — the one lucky-number category that keeps its drawn order instead of renumbering
export const LUCKY_NUMBER_RANK_ID = 'LUCKY_NUMBER_RANK';

// Lotto draw counts (LOTTERY_NUMBER_SETTING). The app binds the bonus-number option to the draw count 1:1
// when the draw is written, so the count is what tells a replay whether the last winner is the bonus number.
export const LOTTERY_NUMBER_SETTING = { DEFAULT_NUM: 6, BONUS_USE: 7 };

// RNG algorithms
export const RANDOM_ALGORITHM_TYPE = { SHA256: 'SHA256', XOSHIRO: 'XOSHIRO' };

// Winner group and class labels, injected into the draw rather than read from inside it — the draw takes
// them as a `labels` argument and pipeline/v1/reproduce.js passes this value in.
// ⚠ These strings end up in the result file as winner group and class names, so they have to match the
//   app locale values (locale._n.drawing.preliminary / text.all) the draw was written with.
export const LABELS = { preliminary: '예비당첨자', all: '전체' };
