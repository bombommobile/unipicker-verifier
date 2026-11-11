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

// Replay pipeline v1 (app 5.0.0 logic) — entrants, win settings, seed and options in, winners and backup
// winners out, in one direction.
// ⚠ Keep the preparation stage's RNG order the same as the app's: entrant rid, win-setting rid, backup rid, draw.
// ⚠ This folder is not updated when the app logic changes — a draw made with v1 has to stay replayable with v1
//   forever. Changed logic is added as pipeline/v2/ and registered with its date range in pipeline/logicVersion.js.
//
// This file is the only place that knows how a bundle becomes a draw. It assembles what the draw functions take
// — input (read-only), rand (RNG), out (what accumulates), labels (injected wording), obs (observation) — and
// nothing downstream carries a draw-wide object around.

import { deriveSortDirection } from '../../core/drawAlgorithms.js';
import Sha256Rand from '../../core/sha256Rand.js';
import XoshiroRand from '../../core/xoshiroRand.js';
import { FIELD_ID } from '../fieldId.js';
import { LABELS, PRELIMINARY_ORDER_TYPE, RANDOM_ALGORITHM_TYPE } from '../constants.js';
import { groupEntriesByType, groupWinSettingsByType, randToLeadingDigits, buildLuckyNumberEntries } from './grouping.js';
import {
  groupDraw,
  matchDraw,
  weightDraw,
  massDraw,
  luckyNumberDraw,
  orderLotteryResultList,
  addEntryDuplicate,
  getLoserList,
} from './draw/index.js';

// Number of winners — drawingCount when it is set, otherwise the sum of the win settings' winCount
const winSettingCount = (drawingCount, winSettingList) =>
  drawingCount > 0
    ? drawingCount
    : winSettingList && winSettingList.length > 0
    ? winSettingList.reduce((c, cur) => {
        const v = cur[FIELD_ID.WIN_COUNT] == null || cur[FIELD_ID.WIN_COUNT] === '' ? 1 : cur[FIELD_ID.WIN_COUNT];
        return c + Number(v);
      }, 0)
    : 0;

// Number of backup winners — the configured headcount for the one-pool method, otherwise the sum of the
// backup settings' winCount
const preliminaryCount = (method, count, preliminary) =>
  method === PRELIMINARY_ORDER_TYPE.ALL.id
    ? Number(count || 0)
    : preliminary
    ? preliminary.reduce((c, cur) => {
        const v = cur[FIELD_ID.WIN_COUNT] == null || cur[FIELD_ID.WIN_COUNT] === '' ? 1 : cur[FIELD_ID.WIN_COUNT];
        return c + Number(v);
      }, 0)
    : 0;

// RNG choice — an official or weighted draw uses the algorithm RNG (a weighted lotto draw is always SHA-256),
// everything else uses the xoshiro stream
const createRng = (seed, randomAlgorithmType, isOfficialDraw, categoryInfo) => {
  const lottoWeight = !!categoryInfo.lotteryNumberWeightUse;
  const useAlgorithmRng = isOfficialDraw || categoryInfo.drawingWeightUse || lottoWeight;
  if (useAlgorithmRng) {
    const useXoshiro = !lottoWeight && randomAlgorithmType === RANDOM_ALGORITHM_TYPE.XOSHIRO;
    return useXoshiro ? new XoshiroRand(seed) : new Sha256Rand(seed);
  }
  return new XoshiroRand(seed);
};

// Ball-number draw, second random number — the last 8 digits of rid x ball number. The sort direction comes
// from the ball number rather than the seed. Consumes no RNG.
const assignDrawingRandomNumber = (input, out) => {
  const number = Number(input.setting.ballNumber);
  out.sortOrderType = deriveSortDirection(input.setting.ballNumber);
  for (const info of input.entryList) {
    const drawRid = info.rid * number;
    info.drawRid = drawRid;
    const s = String(drawRid);
    info.drawUseRid = Number(s.substring(s.length - 8, s.length));
    info.ballNumber = input.setting.ballNumber;
  }
};

/**
 * Replay a draw and produce its winners and backup winners.
 * @param {object} source { seed, isOfficialDraw?, setting, entryList, winSettingList, preliminaryList?, entryCount? }
 * @param {{ onStage?: (stage: string, info?: object) => void }} [hooks] progress notices — no part in the draw
 * @returns {{ winnerList, entryList, loserList }}
 */
export const reproduce = (source, hooks = {}) => {
  const onStage = typeof hooks.onStage === 'function' ? hooks.onStage : () => {};
  const settingIn = { ...source.setting };
  // An unset re-win limit is read as POSSIBLE (no limit), which skips the duplicate handling entirely.
  if (settingIn.duplicateWinLimitUse == null) settingIn.duplicateWinLimitUse = FIELD_ID.POSSIBLE;
  const categoryInfo = { ...settingIn.categoryInfo, lotteryNumberWeightUse: !!settingIn.lotteryNumberWeightUse };
  const seed = String(source.seed);
  const isOfficialDraw = source.isOfficialDraw !== false;

  // Group the entrants, win settings and backup settings (values kept as they are)
  const { entryList, entryListByType } = groupEntriesByType(source.entryList || []);
  const winSettingListByType = new Map();
  const winSettingList = groupWinSettingsByType(source.winSettingList || [], winSettingListByType);
  const preliminaryListByType = new Map();
  const preliminaryList = groupWinSettingsByType(source.preliminaryList || [], preliminaryListByType);

  const preliminaryForCount = settingIn.preliminaryOrderDrawingUse && settingIn.preliminaryOrderDrawingMethod === PRELIMINARY_ORDER_TYPE.TYPE.id ? preliminaryList : null;

  // RNG — the preparation stage and the draw take from one stream, in order.
  const rand = createRng(seed, settingIn.randomAlgorithmType, isOfficialDraw, categoryInfo);

  // Input — what the draw only reads. Once built here it does not change.
  const input = {
    setting: { ...settingIn, seed, categoryInfo },
    categoryInfo,
    // Lucky-number result ordering — only sortWinnerList's lucky-number branch reads it (the app's oper.drawingResultSort).
    resultSort: settingIn.drawingResultSort,
    entryList,
    entryListByType,
    winSettingList,
    winSettingListByType,
    preliminaryList,
    preliminaryListByType,
    // Lucky-number entrants come from a number range, not a file — the lotto generator calls this per set.
    luckyNumberEntries: (set) => buildLuckyNumberEntries(input, rand, set),
  };
  input.winSettingCount = winSettingCount(settingIn.drawingCount, winSettingList);
  input.preliminaryCount = settingIn.preliminaryOrderDrawingUse
    ? preliminaryCount(settingIn.preliminaryOrderDrawingMethod, settingIn.preliminaryOrderDrawingCount, preliminaryForCount)
    : 0;
  input.winSettingTotalCount = input.winSettingCount + input.preliminaryCount;

  // Output — what the draw accumulates. The sort direction is decided here and read by the draw.
  const out = {
    winnerList: [],
    winnerListByGroupKey: new Map(),
    loserList: [],
    loserListByType: new Map(),
    sortOrderType: -1,
  };

  // Observation — no part in the draw. Leaving it out must give the same result.
  const drawLogs = [];
  const obs = { onStage, pushDrawLogs: (line) => drawLogs.push(line) };

  // Labels — the wording the draw builds group and class names from, injected so draw.js holds no locale of
  // its own. ⚠ These strings end up in the result file, so they have to match the app locale the draw ran under.
  const labels = LABELS;

  if (!categoryInfo.isBallNumberInputDrawing) out.sortOrderType = deriveSortDirection(seed);

  // First random number (rid) — consumed in this order: entrants, win settings, backup settings
  const isBall = !!categoryInfo.isBallNumberInputDrawing;
  const isWeighted = !!(categoryInfo.drawingWeightUse || settingIn.lotteryNumberWeightUse);
  // Lucky-number draws have no entrant file — the numbers in the range become the entrants here.
  // The two exceptions keep the ordinary path: ball draws that read entrants from a file, and the lotto
  // generator, which builds its pool per set inside the draw.
  const generatesEntrants = !!categoryInfo.isLuckyNumberDrawing && !categoryInfo.isBallDrawEntryDrawing && !categoryInfo.isLottoNumberGenerator;
  onStage('rid', { total: input.entryList.length, done: 0 });
  if (generatesEntrants) {
    input.entryList = buildLuckyNumberEntries(input, rand);
    onStage('rid', { total: input.entryList.length, done: input.entryList.length });
  } else if (!categoryInfo.isLottoNumberGenerator && !categoryInfo.isMassDraw && !isWeighted) {
    const total = input.entryList.length;
    for (let i = 0; i < total; i++) {
      const info = input.entryList[i];
      const randNum = rand.next();
      info.rid = isBall ? randToLeadingDigits(randNum, 10) : randNum;
      if ((i + 1) % 5000 === 0) onStage('rid', { total, done: i + 1 });
    }
  }
  if (!isWeighted) {
    for (const info of input.winSettingList) info.rid = rand.next();
  }
  for (const info of input.preliminaryList) info.rid = rand.next();

  // Ball-number draw, second random number
  onStage('sort');
  if (isBall) assignDrawingRandomNumber(input, out);

  // Shared re-win state (not for a mass draw, and only when the re-win limit is on)
  if (!categoryInfo.isMassDraw && input.setting.duplicateWinLimitUse !== FIELD_ID.POSSIBLE) {
    addEntryDuplicate(input.entryList, input.setting.duplicateCheckBaseValue);
  }

  // The draw itself — the sorting happens inside the draw functions, so they announce the draw stage
  if (categoryInfo.matchUse) matchDraw(input, out, obs);
  else if (categoryInfo.drawingWeightUse) weightDraw(input, rand, out, true, labels, obs);
  else if (categoryInfo.isLotteryNumberDrawing) {
    if (categoryInfo.isLottoNumberGenerator) luckyNumberDraw(input, rand, out, labels, obs);
    else if (settingIn.lotteryNumberWeightUse) weightDraw(input, rand, out, true, labels, obs);
    else groupDraw(input, out, true, labels, obs);
  } else if (categoryInfo.isMassDraw) massDraw(input, rand, out, Number(source.entryCount), labels, obs);
  else groupDraw(input, out, true, labels, obs);

  // Backup-winner draw (a mass draw does its own inside massDraw)
  const prelimHere = categoryInfo.preliminaryPossible && input.setting.preliminaryOrderDrawingUse === true && !categoryInfo.isMassDraw;
  onStage('prelim', { skipped: !prelimHere && !categoryInfo.isMassDraw });
  if (prelimHere) {
    getLoserList(input, out);
    if (out.loserList.length > 0) {
      if (categoryInfo.drawingWeightUse || settingIn.lotteryNumberWeightUse) weightDraw(input, rand, out, false, labels, obs);
      else groupDraw(input, out, false, labels, obs);
    }
  }

  // A lotto draw's result file is written in a different order than the numbers were drawn — match the app's
  // presentation order (consumes no RNG)
  if (categoryInfo.isLotteryNumberDrawing && !categoryInfo.isLottoNumberGenerator) orderLotteryResultList(input, out);

  // Report what the sort direction was derived from — a ball-number draw uses the ball number, not the seed
  const sortBase = isBall ? String(settingIn.ballNumber) : seed;
  const lastChar = sortBase.charAt(sortBase.length - 1);

  return {
    winnerList: out.winnerList,
    entryList: input.entryList,
    loserList: out.loserList,
    drawLogs,
    rngConsumed: rand.n,
    sortOrderType: out.sortOrderType,
    sortOrderSource: { kind: isBall ? 'ball' : 'seed', value: sortBase, lastChar, numeric: /^\d$/.test(lastChar) },
  };
};

export default reproduce;
