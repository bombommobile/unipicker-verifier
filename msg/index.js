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

// Messages pure modules hand to the UI: a code and values, never wording.
// ⚠ Do not translate here. Calling the dictionary would tie the Worker to a locale and the tests to wording.

/**
 * One message.
 * @param {string} code dictionary key
 * @param {object} [params] placeholder values; put values that appear mid-sentence here instead of concatenating
 * @returns {{code:string, params:object|null}}
 */
export const msg = (code, params) => ({ code, params: params || null });

/** An error carrying a code; the wording is produced by the UI layer. */
export class MessageError extends Error {
  constructor(code, params) {
    super(code);
    this.name = 'MessageError';
    this.code = code;
    this.params = params || null;
  }
}

/**
 * Converts an error into something the UI can receive (Worker → main thread is structured clone, which cannot carry an Error).
 * @returns {{code:string, params:object|null}|string} errors without a code come back as their plain message
 */
export const messageOf = (e) =>
  e instanceof MessageError ? msg(e.code, e.params) : String(e && e.message ? e.message : e);
