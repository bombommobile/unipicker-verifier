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

// Reveal layer: the fingerprint typing and the reproduction row reveal, plus the waits that hold the run back.
// ⚠ A cancel must settle both waits. A promise left unresolved here wedges the message queue in ui/runner.js.

import { PACE } from './stages.js';

// The files enclosed in the bundle and their fingerprints: shows file by file what was read.
// The fingerprint is typed out one character at a time. That only shows the value flowing past; the verdict is already decided.
// ⚠ The typing state lives here, so a re-render resumes where it was and a finished line is left alone
let hashState = null; // [{ filename, text, shown, marked, mark }]
let hashTimer = null;
let typingWait = Promise.resolve(); // the promise that holds the next stage back until everything is shown
let typingDone = null; // its resolver, kept so a cancel can release whoever is waiting

let revealTimer = null;
let revealWait = Promise.resolve(); // holds the next stage back until everything has been revealed
let revealDone = null; // its resolver, kept so a cancel can release whoever is waiting
let innerReveal = 0; // how many reproduction rows have been revealed with their values

/** Whether the fingerprint rows already have typing state, so a re-render does not restart them */
export const typingStarted = () => hashState != null;

/** @returns {{filename: string, text: string, shown: number, marked: boolean, mark?: string}|null} */
export const hashRow = (i) => (hashState ? hashState[i] : null);

/** How many reproduction rows have their value on screen */
export const revealedCount = () => innerReveal;

/** Whether either animation still has a timer pending */
export const animating = () => !!(hashTimer || revealTimer);

/** Settles once both animations have shown everything they hold */
export const settled = () => Promise.all([typingWait, revealWait]);

export const stopTyping = () => {
  if (hashTimer) clearTimeout(hashTimer);
  hashTimer = null;
  hashState = null;
  // ⚠ Release before replacing: the promise already awaited elsewhere would never settle and would wedge drain()
  if (typingDone) typingDone();
  typingDone = null;
  typingWait = Promise.resolve();
};

// Copies the state onto the fingerprint rows currently on screen (the row being typed gets the cursor)
const paintHashes = () => {
  const rows = document.querySelectorAll('#steps .panel .frow');
  (hashState || []).forEach((h, i) => {
    const row = rows[i];
    if (!row) return;
    const typing = h.shown > 0 && h.shown < h.text.length;
    const hash = row.querySelector('.h');
    hash.textContent = h.text.slice(0, h.shown);
    hash.classList.toggle('typing', typing);
    row.querySelector('.m').textContent = h.marked ? h.mark : '';
  });
};

// Advance the state rather than the DOM, so the page can be re-rendered mid-typing
export const startTyping = (checked) => {
  const instant = PACE.type <= 0;
  hashState = checked.map((f) => ({
    filename: f.filename,
    text: f.expected,
    shown: instant ? f.expected.length : 0,
    marked: instant,
  }));
  if (instant) return;
  typingWait = new Promise((finished) => {
    typingDone = finished;
    let i = 0;
    const step = () => {
      const h = hashState && hashState[i];
      if (!h) {
        hashTimer = null;
        finished();
        return;
      }
      if (h.shown < h.text.length) {
        h.shown += 1; // one character at a time, so the typing is visible
        paintHashes();
        hashTimer = setTimeout(step, PACE.type);
        return;
      }
      if (!h.marked) {
        // Leave a beat to take in the finished value before attaching the comparison result
        hashTimer = setTimeout(() => {
          h.marked = true;
          paintHashes();
          i += 1;
          step();
        }, PACE.verify);
        return;
      }
      i += 1;
      step();
    };
    hashTimer = setTimeout(step, PACE.type);
  });
};

export const stopReveal = () => {
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = null;
  innerReveal = 0;
  // ⚠ Same as stopTyping: an unresolved promise here would leave drain() waiting forever
  if (revealDone) revealDone();
  revealDone = null;
  revealWait = Promise.resolve();
};

/**
 * Once the reproduction result arrives the rows are revealed one by one: as a row gets its value, the next one turns running.
 * ⚠ The values are all computed already. What is slowed here is only the order they appear in.
 * @param {number} total how many rows to reveal
 * @param {() => void} render redraws the page after each row
 */
export const startReveal = (total, render) => {
  if (PACE.tick <= 0) {
    innerReveal = total;
    return;
  }
  revealWait = new Promise((done) => {
    revealDone = done;
    const step = () => {
      innerReveal += 1;
      render();
      if (innerReveal >= total) {
        revealTimer = null;
        done();
        return;
      }
      revealTimer = setTimeout(step, PACE.tick);
    };
    revealTimer = setTimeout(step, PACE.tick);
  });
};
