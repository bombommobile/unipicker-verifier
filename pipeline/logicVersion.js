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

// Resolves the app version written in the certificate into a draw logic version.
// The verifier has to reproduce with the logic as it stood when the draw ran, not the logic of today.
//
// ⚠ This file changes when the draw logic changes, not when a release goes out.
//   A release that leaves the logic alone (5.1.1, 5.2.0 and so on) does not touch the table below: its last range is open at the top.

import { msg, MessageError } from '../msg/index.js';

// The first version this verifier covers. A draw run on anything older is out of scope.
export const MIN_APP_VERSION = '5.1.0';

// App version ranges mapped to logic versions, ascending by fromAppVersion, with the last entry left open at the top.
//
// When a release changes the logic, two lines are needed.
//   ① close the previous entry with untilAppVersion, the last app version that shipped that logic, and
//   ② append { logicVersion: 'v2', fromAppVersion: '<the changed version>' } (the implementation goes in pipeline/v2/).
// ⚠ Never edit the fromAppVersion or logicVersion of an existing entry: it would break verification of draws already run in that range.
export const LOGIC_VERSIONS = [
  { logicVersion: 'v1', fromAppVersion: '5.1.0' }, // logic first shipped with the verifier
  // { logicVersion: 'v2', fromAppVersion: '5.3.0' }, // one line on what changed
];

// The most recent app version whose draw sources were compared and found unchanged.
// ⚠ The fingerprint baseline of the ported sources lives on the app side. This must equal the app version of that baseline,
//   and the app tests compare the two, so re-taking the baseline means raising this as well.
export const CONFIRMED_APP_VERSION = '5.1.0';

// Reads '5.1.1', 'v5.1.1' and '5.1.1-beta.2' all as [5,1,1]. A pre-release/build tail plays no part in range
// matching. Anchored to the string's end, so trailing junk ('5x', '5.1.bad', '5.1.0evil') is rejected, not truncated.
export const parseVersion = (value) => {
  if (value == null) return null;
  const m = String(value)
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]*)?$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)];
};

// Negative when a < b, zero when equal, positive when a > b
export const compareVersion = (a, b) => {
  const pa = Array.isArray(a) ? a : parseVersion(a);
  const pb = Array.isArray(b) ? b : parseVersion(b);
  if (!pa || !pb) throw new MessageError('msg.logicVersion.badFormat');
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
};

const isLogicVersionId = (value) => /^v\d+$/.test(String(value == null ? '' : value).trim());

/**
 * Picks the logic version to run. A bundle passes the app version written in it; a caller that already knows the
 * range (fixtures and tests) may pass logicVersion instead.
 * ⚠ A bundle always carries an app version — the schema refuses a missing or blank one — so the no-version path below
 *   is only for direct callers, and it closes as soon as a second logic version is registered.
 * @param {string|{appVersion?: string, logicVersion?: string}} input an app version string, or { appVersion, logicVersion }
 * @returns {{ logicVersion: string, appVersion: string|null, assumed: boolean, unconfirmed: boolean }}
 *   assumed     — no version was passed, so the only registered logic version was taken
 *   unconfirmed — an exact app version was passed, but it is newer than CONFIRMED_APP_VERSION, so sameness of the logic is unconfirmed
 */
export const resolveLogicVersion = (input) => {
  const src = typeof input === 'object' && input !== null ? input : { appVersion: input };
  const picked = src.logicVersion == null ? '' : String(src.logicVersion).trim();
  const raw = src.appVersion == null ? '' : String(src.appVersion).trim();

  // The caller named the range outright, so the app version is not consulted: naming the range already decided it
  if (picked !== '') {
    if (!isLogicVersionId(picked)) throw new MessageError('msg.logicVersion.unknownId', { value: picked });
    const entry = LOGIC_VERSIONS.find((e) => e.logicVersion === picked);
    if (!entry) throw new MessageError('msg.logicVersion.notRegistered', { value: picked });
    return { logicVersion: entry.logicVersion, appVersion: raw || null, assumed: false, unconfirmed: false };
  }

  // No version at all. Unambiguous only while a single logic version is registered; a second one closes this path
  // and every caller has to say which logic it means.
  if (raw === '') {
    if (LOGIC_VERSIONS.length !== 1) throw new MessageError('msg.logicVersion.appVersionMissing');
    return { logicVersion: LOGIC_VERSIONS[0].logicVersion, appVersion: null, assumed: true, unconfirmed: false };
  }

  const parsed = parseVersion(raw);
  if (!parsed) throw new MessageError('msg.logicVersion.badAppVersion', { value: raw });

  if (compareVersion(parsed, MIN_APP_VERSION) < 0) {
    throw new MessageError('msg.logicVersion.belowMin', { min: MIN_APP_VERSION, value: raw });
  }

  let matched = null;
  for (const entry of LOGIC_VERSIONS) {
    if (compareVersion(parsed, entry.fromAppVersion) >= 0) matched = entry;
  }
  // ⚠ A closed range's untilAppVersion is the real upper bound: past it, the version falls into a gap, not into this range
  if (!matched || (matched.untilAppVersion && compareVersion(parsed, matched.untilAppVersion) > 0)) {
    throw new MessageError('msg.logicVersion.noMatch', { value: raw });
  }

  return {
    logicVersion: matched.logicVersion,
    appVersion: raw,
    assumed: false,
    unconfirmed: compareVersion(parsed, CONFIRMED_APP_VERSION) > 0,
  };
};

// The message shown for an unconfirmed app version: it does not block reproduction, and it does not claim certainty either.
export const unconfirmedMessage = (appVersion) =>
  msg('msg.logicVersion.unconfirmed', { appVersion, confirmed: CONFIRMED_APP_VERSION });
