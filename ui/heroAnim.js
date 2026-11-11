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

// Hero code window motion: the code lines fade in, then a magnifier sweeps over them once.
// ⚠ Decoration only — the window is aria-hidden, and without this script the code simply shows in full.

const LINE_STEP = 240;
const BLANK_STEP = 40;
const LENS_FIRST = 1100;
const LENS_HOP = 1300;
const LENS_LAST = 700;
const SCALE = 1.7;
const LENS_R = 52;
/** Width the sweep points were measured against */
const BASE_WIDTH = 480;
/** Sweep points on the code area: zigzags down, staying where the lens and handle are not clipped */
const POINTS = [[110, 40], [300, 100], [120, 150], [340, 184]];

/** ⚠ Held at module scope — an observer with no reference can be collected, and the replay stops firing */
let watcher = null;

/**
 * Wires the hero code window: one run each time the window comes back into view.
 * @param {HTMLElement} term the .term element
 */
const setup = (term) => {
  const code = term.querySelector('.code');
  if (!code) return;

  const rows = code.innerHTML.split('\n');
  code.innerHTML = rows.map((row) => `<span class="ln">${row || ' '}</span>`).join('\n');
  const lines = [...code.querySelectorAll('.ln')];

  const zoom = code.cloneNode(true);
  zoom.classList.add('zoom');
  const lens = document.createElement('div');
  lens.className = 'lens';
  lens.append(zoom);
  const handle = document.createElement('i');
  handle.className = 'lens-handle';
  term.append(lens, handle);

  let timer = null;
  let running = false;
  let away = true;
  const later = (fn, ms) => {
    timer = setTimeout(fn, ms);
  };

  const place = ([x, y]) => {
    const fit = Math.min(1, term.clientWidth / BASE_WIDTH);
    const cx = x * fit;
    const cy = y + code.offsetTop;
    lens.style.transform = `translate(${cx - LENS_R}px, ${cy - LENS_R}px)`;
    zoom.style.transform = `translate(${LENS_R - cx * SCALE}px, ${LENS_R - y * SCALE}px) scale(${SCALE})`;
    handle.style.left = `${cx + LENS_R * 0.7}px`;
    handle.style.top = `${cy + LENS_R * 0.7}px`;
  };

  const setMotion = (on) => {
    lens.style.transition = on ? 'transform .9s ease-in-out, opacity .4s ease' : 'none';
    zoom.style.transition = on ? 'transform .9s ease-in-out' : 'none';
    handle.style.transition = on ? 'left .9s ease-in-out, top .9s ease-in-out, opacity .4s ease' : 'none';
  };

  const showLens = (on) => {
    lens.classList.toggle('on', on);
    handle.classList.toggle('on', on);
  };

  const sweep = () => {
    setMotion(true);
    place(POINTS[0]);
    showLens(true);
    let at = 1;
    const hop = () => {
      if (at >= POINTS.length) {
        later(() => {
          showLens(false);
          running = false;
        }, LENS_LAST);
        return;
      }
      place(POINTS[at++]);
      later(hop, LENS_HOP);
    };
    later(hop, LENS_FIRST);
  };

  const reveal = (i) => {
    if (i >= lines.length) {
      sweep();
      return;
    }
    lines[i].classList.add('on');
    later(() => reveal(i + 1), lines[i].textContent.trim() ? LINE_STEP : BLANK_STEP);
  };

  const play = () => {
    clearTimeout(timer);
    running = true;
    showLens(false);
    lines.forEach((line) => line.classList.remove('on'));
    // ⚠ The lens jumps back only after it has faded, so the jump itself is never seen
    later(() => {
      setMotion(false);
      place(POINTS[0]);
      later(() => reveal(0), 150);
    }, 350);
  };

  term.classList.add('animready');
  watcher = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) {
          away = true;
        } else if (away && !running) {
          away = false;
          play();
        }
      }),
    { threshold: 0.5 },
  );
  watcher.observe(term);
};

const term = document.querySelector('.hero .term');
if (term && !matchMedia('(prefers-reduced-motion: reduce)').matches) setup(term);
