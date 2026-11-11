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

// Verification stages. The progress bar and the failure marker share these ids.
// ⚠ weight is perceived cost (reproduction dominates). Splitting evenly makes the bar disagree with what the user sees.
// ⚠ The package stage runs for mass draws only, so the list is built per run to make the bar end at 100.

import { t } from '../i18n/index.js';

// Display pacing: for small draws reproduction finishes in a blink and no stage would be visible.
// ⚠ Only the display is slowed. Reproduction and comparison already finished in the Worker; this replays their results in order.
export const PACE = { step: 1400, tick: 900, type: 26, verify: 400, gap: 700 };
// step: minimum time a stage stays on screen · tick: between rows of the reproduction table · type: per character of the fingerprint (0 disables the animation)
// verify: from the last fingerprint character to the comparison result · gap: from the last stage to the verdict
// ⚠ No wait between stages: the next one starts as soon as the previous ends

/** Inner reproduction steps, in order. The page reserves room for all of them so rows do not shift as they appear */
export const INNER_STAGES = ['rid', 'sort', 'draw', 'prelim'];

export const ALL_STAGES = [
  { id: 'bundle', weight: 3 },
  { id: 'package', weight: 5, massOnly: true },
  { id: 'seedDerive', weight: 1 },
  { id: 'reproduce', weight: 8 },
  { id: 'compare', weight: 1 },
];

/**
 * The stages this run actually goes through.
 * @param {{mass?: boolean}} [opt] when mass, include the package comparison stage
 */
export const stageList = (opt = {}) => ALL_STAGES.filter((s) => !s.massOnly || opt.mass);

/** Stage label. The wording comes from the dictionary. */
export const stageLabel = (id) => t(`stage.${id}`);

/**
 * Overall progress in percent, from the current stage id and the progress inside it (0..1).
 * @param {Array} stages result of stageList()
 * @param {string} id the stage running now
 * @param {number} [intra] progress inside the stage, 0..1
 */
export const stagePercent = (stages, id, intra = 0) => {
  const total = stages.reduce((s, x) => s + x.weight, 0);
  const index = stages.findIndex((s) => s.id === id);
  if (index < 0) return 0;
  let before = 0;
  for (let i = 0; i < index; i++) before += stages[i].weight;
  return Math.min(100, Math.round(((before + stages[index].weight * Math.min(1, Math.max(0, intra))) / total) * 100));
};
