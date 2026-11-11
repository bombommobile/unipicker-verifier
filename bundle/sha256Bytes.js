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

// SHA-256 of raw bytes: WebCrypto when the page has it, the vendored pure JS implementation otherwise.
// ⚠ crypto.subtle exists only in a secure context (HTTPS, localhost), so a page opened over plain HTTP has none.

import { sha256 } from '../vendor/js-sha256.js';

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>} the 32-byte digest
 */
export const sha256Bytes = async (bytes) => {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (subtle) return new Uint8Array(await subtle.digest('SHA-256', bytes));
  return new Uint8Array(sha256.arrayBuffer(bytes));
};
