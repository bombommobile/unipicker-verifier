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

// Worker lifecycle and the run queue: owns the reproduction thread and paces the messages it sends back.
// ⚠ ui/worker.js owns the Worker message contract (run·cancel·reset·log ↔ ready·progress·done·cancelled·error·log).

import { getLocale } from '../i18n/index.js';
import { PACE } from './stages.js';
import { settled } from './reveal.js';

let worker = null;
let runToken = 0;
let logSeq = 0;
let pending = null; // the job waiting for ready, for environments that drop messages sent before the module loads

let queue = [];
let draining = false;
let drainToken = 0;

// When each thing appeared on screen, which is what the minimum durations are measured against
let stageAt = 0; // when the current stage started
let innerAt = 0; // when the last row of the reproduction table appeared
let doneAt = 0; //  when the last stage turned done

let applyMessage = () => {}; // set by initRunner: puts one message on screen

/**
 * Wires the screen callback the queue drains into.
 * @param {{apply: (m: object) => void}} deps
 */
export const initRunner = ({ apply }) => {
  applyMessage = apply;
};

/** The run the screen belongs to. A reply carrying any other token is from a run that is over. */
export const currentToken = () => runToken;

/** Opens a new run and returns its token, so replies from the previous one are dropped */
export const nextToken = () => ++runToken;

export const hasWorker = () => !!worker;

export const clearPending = () => {
  pending = null;
};

export const killWorker = () => {
  if (worker) worker.terminate();
  worker = null;
};

export const markStage = () => {
  stageAt = Date.now();
};
export const markInner = () => {
  innerAt = Date.now();
};
export const markDone = () => {
  doneAt = Date.now();
};

// Abandons a drain() that is suspended on a pace wait.
// ⚠ Without this a cancel leaves draining stuck at true and the next run's messages pile up with nobody showing them
export const abortDrain = () => {
  queue = [];
  drainToken++;
  draining = false;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * How long (ms) to wait before putting this message on screen.
 * ⚠ This does not stretch the gap between stages; it only checks whether the running stage met its minimum.
 */
const holdFor = (m) => {
  const left = (since, min) => Math.max(0, min - (Date.now() - since));
  if (m.type === 'done') return left(doneAt, PACE.gap);
  if (m.type !== 'progress') return 0;
  if (m.info && m.info.done) return left(stageAt, PACE.step);
  return 0;
};

const drain = async () => {
  const mine = ++drainToken;
  draining = true;
  while (queue.length > 0 && mine === drainToken) {
    const hold = holdFor(queue[0]);
    if (hold > 0) {
      await sleep(hold);
      continue; // a cancel during the wait may have emptied the queue
    }
    applyMessage(queue.shift());
    await settled(); // move on only after the results are fully shown
  }
  if (mine === drainToken) draining = false; // a newer drain owns the flag from here on
};

const onMessage = (m) => {
  if (m.token != null && m.token !== runToken) return; // drop late replies from a previous run

  if (m.type === 'ready') {
    if (!pending) return;
    const { job, token } = pending;
    pending = null;
    // The bytes are transferred, not copied; a re-run reads them from the File again
    const transfer = [job.bundle.buffer].concat(job.package ? [job.package.buffer] : []);
    worker.postMessage({ type: 'run', token, locale: getLocale(), bundle: job.bundle, package: job.package }, transfer);
    return;
  }

  // Cancel, error and log are not paced; queued progress messages are dropped
  if (m.type === 'cancelled' || m.type === 'error' || m.type === 'log') {
    abortDrain();
    applyMessage(m);
    return;
  }

  queue.push(m);
  if (!draining) drain();
};

/**
 * Starts the reproduction thread on one job. The bytes are handed over once the Worker says it is ready.
 * @param {{job: {bundle: Uint8Array, package: Uint8Array|null}, token: number, onError: (e: ErrorEvent) => void}} run
 */
export const startWorker = ({ job, token, onError }) => {
  pending = { job, token };
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (ev) => onMessage(ev.data);
  worker.onerror = onError;
};

/** Asks the still-living Worker for the detailed log of the run it just finished */
export const requestLog = (locale) => {
  worker.postMessage({ type: 'log', id: ++logSeq, locale });
};
