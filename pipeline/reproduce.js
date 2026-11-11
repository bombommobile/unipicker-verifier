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

// Public entry point for reproduction: pick the logic version from the certificate's app version, then delegate to that version's implementation.
// ⚠ No draw logic lives here. Logic belongs inside a version folder such as pipeline/v1/.

import { resolveLogicVersion } from './logicVersion.js';
import { REPRODUCE_BY_LOGIC_VERSION } from './versions.js';
import { MessageError } from '../msg/index.js';

export { resolveLogicVersion };

/**
 * Reproduces the draw and yields winners and preliminary winners.
 * @param {object} input reproduction input plus either appVersion (the version written in the bundle) or logicVersion (a range named by the caller)
 * @param {{ onStage?: (stage: string, info?: object) => void }} [hooks]
 * @returns {object} the implementation's return value plus { logicVersion, appVersion, appVersionAssumed, appVersionUnconfirmed }
 */
export const reproduce = (input, hooks = {}) => {
  const resolved = resolveLogicVersion({
    appVersion: input && input.appVersion,
    logicVersion: input && input.logicVersion,
  });
  const impl = REPRODUCE_BY_LOGIC_VERSION[resolved.logicVersion];
  if (!impl) throw new MessageError('msg.logicVersion.notRegistered', { value: resolved.logicVersion });

  const out = impl(input, hooks);
  return {
    ...out,
    logicVersion: resolved.logicVersion,
    appVersion: resolved.appVersion,
    appVersionAssumed: resolved.assumed,
    appVersionUnconfirmed: resolved.unconfirmed,
  };
};

export default reproduce;
