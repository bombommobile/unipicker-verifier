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

// Verification Web Worker: unzip, hash, reproduce and compare all run here so the page never freezes.
// ⚠ Some environments drop messages that arrive before the module finishes loading, so we handshake with a ready signal first.
// ⚠ Nothing is posted after a cancel. A late result overwriting the screen reads as "cancel did not work".
// ⚠ The locale rides on the run/log messages. Reproduction and comparison do not depend on it; only log wording does.

import { setLocale } from '../i18n/index.js';
import { messageOf } from '../msg/index.js';
import { runVerify, CancelledError } from './verifyBundleRun.js';
import { buildLogLines, logPreview } from './report.js';

/**
 * Message handler. The send function is injected so the same code runs outside a Worker (tests).
 * @param {(message: object) => void} post send to the main thread
 */
export const createHandler = (post) => {
  // The last run stays in this thread only; the detailed log is built here when it is asked for
  let lastRun = null;
  let runningToken = null;
  let cancelledToken = null;

  const handle = async (data) => {
    const message = data || {};
    // Log wording is produced in this thread, so the page sends its current locale with every message
    if (message.locale) setLocale(message.locale);

    if (message.type === 'cancel') {
      cancelledToken = message.token != null ? message.token : runningToken;
      return;
    }

    if (message.type === 'reset') {
      lastRun = null;
      return;
    }

    if (message.type === 'log') {
      if (!lastRun) {
        post({ type: 'log', id: message.id, error: messageOf(new Error('run.needRerun')) });
        return;
      }
      const lines = buildLogLines(lastRun);
      post({ type: 'log', id: message.id, preview: logPreview(lines), lines });
      return;
    }

    if (message.type !== 'run') return;

    const token = message.token;
    runningToken = token;
    cancelledToken = null;
    lastRun = null;

    const stop = () => {
      if (cancelledToken === token) throw new CancelledError();
    };

    try {
      const result = await runVerify({
        bundleBytes: message.bundle,
        packageBytes: message.package,
        onStage: (stage, info) => {
          stop();
          post({ type: 'progress', token, stage, percent: info.percent, info });
        },
      });
      stop();
      lastRun = { verdict: result.verdict, log: result.log };
      post({ type: 'done', token, verdict: result.verdict, facts: result.facts, mismatches: result.mismatches, hasLog: !!result.log });
    } catch (e) {
      if (e && e.cancelled) {
        post({ type: 'cancelled', token });
        return;
      }
      post({ type: 'error', token, message: messageOf(e) });
    } finally {
      if (runningToken === token) runningToken = null;
    }
  };

  return { handle };
};

// Attach only when loaded as a Worker; tests call createHandler directly
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof self.importScripts !== 'undefined') {
  const { handle } = createHandler((m) => self.postMessage(m));
  self.onmessage = (ev) => handle(ev.data);
  self.postMessage({ type: 'ready' });
}
