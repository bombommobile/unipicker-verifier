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

// UI layer of the verifier: draws upload, run and verdict as one vertical list of steps.
// ⚠ No network is used. Files are read inside the browser and never sent anywhere.
// ⚠ ui/runner.js owns the Worker and the run queue; ui/reveal.js owns the typing and row-reveal animations.

import { t, tm, applyMarkup, setLocale, getLocale } from '../i18n/index.js';
import { stageList, stageLabel, INNER_STAGES } from './stages.js';
import { verdictLabel, sortOrderLabel } from './report.js';
import { animating, hashRow, revealedCount, settled, startReveal, startTyping, stopReveal, stopTyping, typingStarted } from './reveal.js';
import {
  abortDrain,
  clearPending,
  currentToken,
  hasWorker,
  initRunner,
  killWorker,
  markDone,
  markInner,
  markStage,
  nextToken,
  requestLog,
  startWorker,
} from './runner.js';
import { findCategory, categoryLabel } from '../domain/categories.js';
import { zipEntryNames, readZipText } from '../parse/xlsx-min.js';
import { VERIFICATION_JSON } from '../bundle/schema.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);

// The URL picks the language: the root page is Korean and /en/ is English, and each index.html
// carries its own language in the lang attribute (its wording is already baked into the page).
// ⚠ Language is display only. Reproduction and comparison must give the same result in any language.
setLocale(document.documentElement.lang);
applyMarkup();

// ── Notices and errors ──
const clearMsgs = () => {
  $('msgs').innerHTML = '';
};
const addMsg = (cls, text) => {
  const el = document.createElement('div');
  el.className = `msg ${cls}`;
  el.textContent = text;
  $('msgs').appendChild(el);
};

// ── Screen state ──
// Uploads are kept as File handles only; the bytes are read right before the run and handed to the Worker (lower peak memory)
const FILE = { bundle: { input: 'bundle-file' }, package: { input: 'package-file' } };
const picked = { bundle: null, package: null };
let isMass = false;
let phase = 'empty'; // empty · idle · running · done
let stages = stageList();
let currentStage = null;
let innerSeen = []; // inner reproduction steps, so the long stage shows where it is
let doneStages = new Set(); // stages finished, results included
let innerInfo = {}; // values reported by the inner reproduction steps (entry count and so on)
let liveFacts = {}; // per-stage results, shown where they belong instead of waiting for the final verdict
let lastDone = null;
let dragKey = null;

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

const sizeText = (bytes) =>
  bytes >= 1024 * 1024
    ? t('file.size.mb', { value: (bytes / 1048576).toFixed(1) })
    : t('file.size.kb', { value: String(Math.max(1, Math.round(bytes / 1024))) });

// ── Verdict ↔ stage ──
// Verdict tone: separates a definite disagreement (mismatch, seed, package) from "could not be read, so cannot be judged" (pending, unverifiable)
const TONE = { match: 'ok', mismatch: 'no', seedMismatch: 'no', packageMismatch: 'no', pending: 'hold', unverifiable: 'hold' };
const GLYPH = { ok: '✓', no: '✕', hold: '✕' };

// Which stage went wrong, so the failure is marked on that stage's own row
const failedStageOf = (done) => {
  if (!done || done.verdict === 'match') return null;
  if (done.verdict === 'seedMismatch') return 'seedDerive';
  if (done.verdict === 'packageMismatch') return 'package';
  if (done.verdict === 'mismatch' || done.verdict === 'pending') return 'compare';
  return (done.facts && done.facts.failedStage) || 'bundle';
};

// Joins only the items that disagreed in the package comparison
const packageReason = (pkg) => {
  const out = [];
  if (!pkg.packageHashMatch) out.push(t('facts.package.hash'));
  if (!pkg.manifestMatch) out.push(t('facts.package.manifest'));
  if (!pkg.merkleMatch) out.push(t('facts.package.merkle'));
  if (pkg.fileHashMismatch.length > 0) out.push(t('facts.package.files', { count: pkg.fileHashMismatch.length }));
  if (pkg.missingLines.length > 0) out.push(t('facts.package.lines', { count: pkg.missingLines.length }));
  return out.join(t('sep.list'));
};

const verdictSub = (verdict, facts) => {
  const c = facts.compare;
  if (verdict === 'match') {
    return (
      t('verdict.match.sub', { winner: c.winner.actual }) +
      (c.preliminary.actual > 0 ? t('verdict.match.sub.prelim', { prelim: c.preliminary.actual }) : '')
    );
  }
  if (verdict === 'mismatch') {
    return (
      t('verdict.mismatch.sub', { actual: c.winner.actual, matched: c.winner.matched }) +
      (c.preliminary.actual > 0 ? t('verdict.mismatch.sub.prelim', { actual: c.preliminary.actual, matched: c.preliminary.matched }) : '')
    );
  }
  if (verdict === 'seedMismatch') return t('verdict.seedMismatch.sub', { derived: facts.seed.derived, seed: facts.seed.seed });
  if (verdict === 'packageMismatch') return t('verdict.packageMismatch.sub', { reason: packageReason(facts.package) });
  if (verdict === 'pending') return tm(facts.pendingReason);
  return tm(facts.reason); // unverifiable: the reason text says where it stopped
};

// Label for an enclosed file: turns the key the bundle assigned into a readable name
const fileKindLabel = (f) => (f.key ? t(`facts.file.${f.key}`) : f.filename);

// Label for the seed origin. Each source counts in its own unit (Drand = Round, NIST = Pulse Index).
// ⚠ Only the values written in the bundle (seedSource, seedRound) are shown. The source is never queried again.
const SEED_ORIGIN = { DRAND: 'seed.origin.drand', NIST: 'seed.origin.nist' };
const seedOriginOf = (seed) => {
  const o = seed && seed.origin;
  if (!o || !o.name || !o.round) return null;
  const key = SEED_ORIGIN[o.name];
  return { source: key ? t(key, { round: o.round }) : `${o.name} ${o.round}` };
};

// One line on the seed check, naming source and round so the value's origin is visible
const seedDetail = (seed) => {
  if (seed.note === 'noSource') return t('facts.seedDerive.none');
  const o = seedOriginOf(seed);
  if (seed.match) return o ? t('facts.seedDerive.match.origin', { source: o.source }) : t('facts.seedDerive.match');
  return o
    ? t('facts.seedDerive.mismatch.origin', { source: o.source, derived: seed.derived })
    : t('facts.seedDerive.mismatch', { derived: seed.derived });
};

// Seed row of the draw information table, pointing out that it was derived from the source random value
const seedSummary = (seed) => {
  if (seed.note === 'noSource') return t('facts.seedDerive.none');
  const o = seedOriginOf(seed);
  if (seed.match) return o ? t('facts.seedDerive.match.summary', { source: o.source }) : t('facts.seedDerive.match');
  return o
    ? t('facts.seedDerive.mismatch.summary', { source: o.source, derived: seed.derived })
    : t('facts.seedDerive.mismatch', { derived: seed.derived });
};

// One line attached to a finished stage, stating in values what that stage actually checked
const stageDoneDetail = (id, facts) => {
  if (!facts) return null;
  if (id === 'bundle' && facts.appVersion) {
    return t('stage.bundle.doneFacts', { schema: facts.schemaVersion, app: facts.appVersion });
  }
  if (id === 'package' && facts.package) return facts.package.ok ? t('stage.package.doneFacts') : packageReason(facts.package);
  if (id === 'seedDerive' && facts.seed) return seedDetail(facts.seed);
  if (id === 'reproduce' && facts.reproducedCounts) {
    const c = facts.reproducedCounts;
    return c.prelim > 0
      ? t('stage.reproduce.doneFacts.prelim', { winner: c.winner, prelim: c.prelim })
      : t('stage.reproduce.doneFacts', { winner: c.winner });
  }
  if (id === 'compare' && facts.compare) {
    const c = facts.compare;
    if (!c.isMatch) return t('stage.compare.doneFacts.partial', { actual: c.winner.actual, matched: c.winner.matched });
    return c.preliminary.actual > 0
      ? t('stage.compare.doneFacts.prelim', { winner: c.winner.actual, prelim: c.preliminary.actual })
      : t('stage.compare.doneFacts', { winner: c.winner.actual });
  }
  return null;
};

// ── Drawing the stage rows ──
const STATUS_TEXT = { pending: 'status.pending', active: 'status.active', running: 'status.running', done: 'status.done' };

const stepRow = (n, kind, label, detail) => {
  const row = el('div', `step ${kind}`);
  if (kind !== 'pending') row.classList.add('lit');
  const mark = el('div', 'mark');
  if (kind === 'running') {
    mark.appendChild(el('span', 'spin'));
  } else {
    mark.appendChild(el('span', 'dot', kind === 'done' ? '✓' : kind === 'failed' ? '!' : String(n)));
  }
  mark.appendChild(el('span', 'rail'));
  const body = el('div', 'body');
  const head = el('div', 'head');
  head.appendChild(el('span', 'label', label));
  const status = el('span', 'status', kind === 'failed' ? '' : t(STATUS_TEXT[kind]));
  head.appendChild(status);
  body.appendChild(head);
  body.appendChild(el('span', 'detail', detail));
  row.append(mark, body);
  return { row, body, status };
};

const UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>';

const dropZone = (key, title, desc) => {
  const box = el('div', 'drop');
  if (dragKey === key) box.classList.add('drag');
  const icon = el('span', 'ic');
  icon.innerHTML = UPLOAD_ICON;
  box.appendChild(icon);
  box.appendChild(el('span', 't', title));
  box.appendChild(el('span', 'd', desc));
  box.appendChild(el('span', 'privacy', t('drop.privacy')));
  const pick = el('button', 'button primary pick', t('drop.pick'));
  pick.type = 'button';
  pick.onclick = () => $(FILE[key].input).click();
  box.appendChild(pick);
  box.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragKey !== key) {
      dragKey = key;
      box.classList.add('drag');
    }
  });
  box.addEventListener('dragleave', () => {
    dragKey = null;
    box.classList.remove('drag');
  });
  box.addEventListener('drop', (e) => {
    e.preventDefault();
    dragKey = null;
    box.classList.remove('drag');
    setFile(key, e.dataTransfer.files[0]);
  });
  return box;
};

const filledBox = (key, kindLabel) => {
  const f = picked[key];
  const box = el('div', 'filled');
  box.appendChild(el('span', 'kind', kindLabel));
  box.appendChild(el('span', 'name', f.name));
  box.appendChild(el('span', 'size', sizeText(f.size)));
  const btn = el('button', null, t('file.change'));
  btn.type = 'button';
  btn.disabled = phase === 'running' || phase === 'done';
  btn.onclick = () => clearFile(key);
  box.appendChild(btn);
  return box;
};

const startBox = () => {
  const box = el('div', 'startbox');
  const btn = el('button', 'button primary', t('run.start'));
  btn.type = 'button';
  btn.dataset.arrow = '→';
  btn.disabled = !ready();
  btn.onclick = () => startRun();
  box.appendChild(btn);
  if (isMass && !picked.package) box.appendChild(el('span', 'hint', t('run.startHint')));
  return box;
};

const fileListPanel = (facts) => {
  const checked = facts && facts.fileHashes ? facts.fileHashes.checked || [] : [];
  if (checked.length === 0) return null;
  if (!typingStarted()) startTyping(checked);
  const panel = el('div', 'panel');
  checked.forEach((f, i) => {
    const ok = f.actual === f.expected;
    const mark = ok ? t('file.hash.ok') : t('file.hash.no');
    const state = hashRow(i) || { shown: f.expected.length, marked: true };
    state.mark = mark;
    const row = el('div', 'frow');
    row.appendChild(el('span', 'k', f.filename));
    const hash = el('span', 'h', f.expected.slice(0, state.shown));
    if (state.shown > 0 && state.shown < f.expected.length) hash.classList.add('typing');
    row.appendChild(hash);
    row.appendChild(el('span', `m${ok ? '' : ' no'}`, state.marked ? mark : ''));
    panel.appendChild(row);
  });
  return panel;
};

// Values produced by the inner reproduction steps; a value that is not known yet stays as a running indicator.
// ⚠ A row without its value never flips to "done": sort direction and counts only arrive when reproduction ends,
//   so writing "done" first and replacing it with a value later would change the same row twice
const tickerValue = (id, facts, running) => {
  const counts = facts && facts.reproducedCounts;
  if (id === 'rid') {
    const entry = innerInfo.rid && innerInfo.rid.total != null ? innerInfo.rid.total : facts && facts.summary ? facts.summary.entryCount : null;
    if (entry != null) return t('ticker.entry', { count: entry });
  }
  if (id === 'sort' && facts && facts.sortOrderType != null) {
    return t('ticker.sort', { dir: sortOrderLabel(facts.sortOrderType) });
  }
  if (id === 'draw' && counts) return t('ticker.count', { count: counts.winner });
  if (id === 'prelim' && counts) return t('ticker.count', { count: counts.prelim });
  return t(running ? 'status.running' : 'status.done');
};

// Inner reproduction progress: rows stack up to the last one with a value, plus one running row
const tickerPanel = (running, facts) => {
  if (innerSeen.length === 0) return null;
  const revealed = revealedCount();
  const rows = Math.min(innerSeen.length, revealed + (revealed < innerSeen.length ? 1 : 0));
  const panel = el('div', 'panel');
  innerSeen.slice(0, rows).forEach((id, i) => {
    const row = el('div', 'trow');
    row.appendChild(el('span', 'g', stageLabel(id)));
    row.appendChild(el('span', 'v', i < revealed ? tickerValue(id, facts, false) : t('status.running')));
    panel.appendChild(row);
  });
  if (revealed < INNER_STAGES.length) panel.appendChild(el('span', 'busy', t('ticker.busy')));
  return panel;
};

const render = () => {
  const box = $('steps');
  box.innerHTML = '';
  const facts = lastDone ? lastDone.facts || {} : liveFacts;
  const failedStage = failedStageOf(lastDone);
  const failedIndex = failedStage ? stages.findIndex((s) => s.id === failedStage) : -1;
  const currentIndex = currentStage ? stages.findIndex((s) => s.id === currentStage) : -1;
  const locked = phase === 'running' || phase === 'done';
  let n = 1;

  // ① The verification file: on its own it is enough (only mass draws open ②)
  {
    const empty = !picked.bundle;
    const { row, body } = stepRow(
      n++,
      empty ? 'active' : 'done',
      t('step.upload.title'),
      empty ? t('step.upload.detail.empty') : isMass ? t('step.upload.detail.mass') : t('step.upload.detail.filled'),
    );
    body.appendChild(empty ? dropZone('bundle', t('step.upload.dropTitle'), t('step.upload.dropDesc')) : filledBox('bundle', t('file.kind.zip')));
    if (!empty && !isMass && phase === 'idle') body.appendChild(startBox());
    box.appendChild(row);
  }

  // ② The original entry package: shown only for a mass-draw bundle, and required there
  if (isMass) {
    const noBundle = !picked.bundle;
    const empty = !picked.package;
    const kind = noBundle ? 'pending' : empty ? 'active' : 'done';
    const { row, body } = stepRow(
      n++,
      kind,
      t('step.package.title'),
      noBundle ? t('step.package.detail.pending') : empty ? t('step.package.detail.empty') : t('step.package.detail.filled'),
    );
    if (!noBundle) {
      body.appendChild(empty ? dropZone('package', t('step.package.dropTitle'), t('step.package.dropDesc')) : filledBox('package', t('file.kind.pkg')));
    }
    if (phase === 'idle') body.appendChild(startBox());
    box.appendChild(row);
  }

  // ③ Run stages: progress and the point of failure are marked on the same vertical line
  stages.forEach((s, i) => {
    let kind = 'pending';
    if (phase === 'running') kind = doneStages.has(s.id) || i < currentIndex ? 'done' : i === currentIndex ? 'running' : 'pending';
    else if (phase === 'done') {
      if (failedIndex >= 0 && i === failedIndex) kind = 'failed';
      else if (failedIndex >= 0 && i > failedIndex) kind = 'pending';
      else kind = 'done';
    }
    const detail =
      kind === 'failed'
        ? verdictSub(lastDone.verdict, facts)
        : (kind === 'done' && stageDoneDetail(s.id, facts)) || t(`stage.${s.id}.detail`);
    const { row, body, status } = stepRow(n++, kind, stageLabel(s.id), detail);
    status.textContent = kind === 'failed' ? verdictLabel(lastDone.verdict) : t(STATUS_TEXT[kind]);
    if (s.id === 'bundle' && kind !== 'pending') {
      const panel = fileListPanel(facts);
      if (panel) body.appendChild(panel);
    }
    if (s.id === 'reproduce' && kind !== 'pending') {
      const panel = tickerPanel(kind === 'running', facts);
      if (panel) body.appendChild(panel);
    }
    if (i === stages.length - 1) row.querySelector('.rail').remove();
    box.appendChild(row);
  });

  show($('runchip'), phase === 'running');
  show($('type-chip'), !!picked.bundle);
  $('type-chip').textContent = isMass ? t('run.type.mass') : t('run.type.normal');
  for (const key of Object.keys(FILE)) $(FILE[key].input).disabled = locked;
};

const setProgress = (pct) => {
  const v = Math.max(0, Math.min(100, Math.round(pct || 0)));
  $('pfill').style.width = `${v}%`;
  $('pbar').setAttribute('aria-valuenow', String(v));
  $('ptext').textContent = t('run.percent', { pct: v });
};

// ── File slots ──
// A mass-draw bundle cannot have its entries checked without the original package, so we peek at verification.json and open the slot only then.
// ⚠ No error is raised here. A bundle that cannot be read is explained properly by the run stages as an "unverifiable" verdict.
const peekIsMass = async (file) => {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!zipEntryNames(bytes).includes(VERIFICATION_JSON)) return false;
    const bundle = JSON.parse(readZipText(bytes, VERIFICATION_JSON));
    const cat = findCategory(bundle && bundle.drawing && bundle.drawing.category ? bundle.drawing.category.id : '');
    return !!(cat && cat.categoryInfo.isMassDraw);
  } catch (e) {
    return false;
  }
};

const ready = () => !!picked.bundle && (!isMass || !!picked.package);

const setFile = async (key, file) => {
  if (!file) return;
  if (!/\.zip$/i.test(file.name)) {
    addMsg('err', t('file.dropRejected', { accept: '.zip' }));
    return;
  }
  clearMsgs();
  picked[key] = file;
  if (key === 'bundle') {
    isMass = await peekIsMass(file);
    if (!isMass) clearInput('package');
  }
  stages = stageList({ mass: isMass });
  phase = 'idle';
  render();
};

const clearInput = (key) => {
  picked[key] = null;
  $(FILE[key].input).value = '';
};

const clearFile = (key) => {
  clearMsgs();
  clearInput(key);
  if (key === 'bundle') {
    clearInput('package');
    isMass = false;
    stages = stageList();
    phase = 'empty';
  } else {
    phase = 'idle';
  }
  render();
};

for (const key of Object.keys(FILE)) {
  $(FILE[key].input).addEventListener('change', (e) => setFile(key, e.target.files[0]));
}

// Stops the browser from opening a file dropped outside the drop zones
for (const ev of ['dragover', 'drop']) document.addEventListener(ev, (e) => e.preventDefault());

// ── Run ──
const scrollToCurrent = () => {
  const node = $('steps').querySelector('.step.running');
  if (!node) return;
  const top = Math.max(0, node.getBoundingClientRect().top + window.scrollY - 170);
  window.scrollTo({ top, behavior: 'smooth' });
};

const startRun = async () => {
  clearMsgs();
  if (!picked.bundle) {
    addMsg('err', t('error.bundleNeeded'));
    return;
  }
  if (isMass && !picked.package) {
    addMsg('err', t('msg.verify.packageNeeded'));
    return;
  }
  if (typeof Worker === 'undefined') {
    addMsg('err', t('run.error.workerUnsupported'));
    return;
  }

  let job;
  try {
    job = {
      bundle: new Uint8Array(await picked.bundle.arrayBuffer()),
      package: picked.package ? new Uint8Array(await picked.package.arrayBuffer()) : null,
    };
  } catch (e) {
    addMsg('err', t('file.readFailed'));
    return;
  }

  killWorker();
  lastDone = null;
  const token = nextToken();
  stages = stageList({ mass: isMass });
  abortDrain();
  innerSeen = [];
  doneStages = new Set();
  liveFacts = {};
  innerInfo = {};
  stopTyping();
  stopReveal();
  phase = 'running';
  currentStage = stages[0].id;
  show($('sec-result-view'), false);
  render();
  setProgress(0);
  scrollToCurrent();

  startWorker({
    job,
    token,
    onError: (e) => {
      killWorker();
      phase = 'idle';
      render();
      // ⚠ Browsers report a Worker load failure with an empty reason, so with no reason we tell the user what they can do
      addMsg('err', e.message ? t('run.error.runFailed', { message: e.message }) : t('run.error.workerLoadFailed'));
    },
  });
};

/**
 * Applies one message to the screen.
 * @returns {string|null} what kind of pause the next message needs (stage · inner · done), or null for none
 */
const apply = (m) => {
  if (m.token != null && m.token !== currentToken()) return null;

  if (m.type === 'progress') {
    // If the peek failed and the stage list is wrong, follow the stages that actually arrive (the bundle decides whether it is a mass draw)
    if (!stages.some((s) => s.id === m.stage)) stages = stageList({ mass: true });
    const inner = m.info && m.info.inner;
    const newInner = !!inner && innerSeen[innerSeen.length - 1] !== inner;
    if (newInner) {
      innerSeen.push(inner);
      markInner();
    }
    if (inner && m.info.info) innerInfo[inner] = m.info.info;
    const moved = currentStage !== m.stage;
    if (moved) {
      doneStages.add(currentStage);
      markStage();
    }
    currentStage = m.stage;
    // Results carried by a finishing stage, filled into that stage's row
    const finished = m.info && m.info.done;
    const next = finished ? stages[stages.findIndex((s) => s.id === m.stage) + 1] : null;
    if (finished) Object.assign(liveFacts, finished);
    setProgress(m.percent);
    render(); // fingerprint typing starts here

    if (finished && m.stage === 'reproduce' && innerSeen.length > 0) startReveal(innerSeen.length, render);

    if (finished) {
      // ⚠ A stage does not turn done before its results are fully shown: a next stage running mid-typing reads as skipping the previous one
      // ⚠ The next stage is not started early either: if it were already running when its start signal arrives, its on-screen time would be zero
      const settle = () => {
        doneStages.add(m.stage);
        markDone();
        render();
      };
      if (animating()) {
        const token = currentToken();
        settled().then(() => {
          if (token === currentToken()) settle();
        });
      } else {
        settle();
      }
    }
    if (moved) scrollToCurrent();
    return finished ? (next ? 'gap' : 'stage') : moved ? 'stage' : newInner ? 'inner' : null;
  }

  if (m.type === 'done') {
    phase = 'done';
    currentStage = null;
    lastDone = m; // the Worker is kept alive to serve a detailed log request
    setProgress(100);
    render();
    renderResult(m);
    return 'done';
  }

  if (m.type === 'cancelled') {
    phase = 'idle';
    currentStage = null;
    setProgress(0);
    render();
    addMsg('warn', t('run.cancelled'));
    return null;
  }

  if (m.type === 'error') {
    killWorker();
    phase = 'idle';
    currentStage = null;
    setProgress(0);
    render();
    addMsg('err', t('run.error.runFailed', { message: tm(m.message) }));
    return null;
  }

  if (m.type === 'log') {
    if (m.error) {
      addMsg('warn', tm(m.error));
      return null;
    }
    // The line array goes straight into a Blob, avoiding one huge string and lowering peak memory
    downloadBlob(new Blob(m.lines.map((l) => `${l}\r\n`), { type: 'text/plain;charset=utf-8' }), logFileName());
  }
  return null;
};

initRunner({ apply });

// Reproduction only sees a cancel at its progress checkpoints, so the thread is terminated to stop long stages at once
$('cancel').onclick = () => {
  killWorker();
  clearPending();
  lastDone = null;
  abortDrain();
  doneStages = new Set();
  liveFacts = {};
  innerInfo = {};
  stopTyping();
  stopReveal();
  nextToken();
  phase = 'idle';
  currentStage = null;
  setProgress(0);
  render();
  addMsg('warn', t('run.cancelled'));
};

$('btn-again').onclick = () => {
  killWorker();
  lastDone = null;
  clearMsgs();
  clearInput('bundle');
  clearInput('package');
  isMass = false;
  stages = stageList();
  abortDrain();
  innerSeen = [];
  doneStages = new Set();
  liveFacts = {};
  innerInfo = {};
  stopTyping();
  stopReveal();
  phase = 'empty';
  currentStage = null;
  setProgress(0);
  show($('sec-result-view'), false);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ── Result ──
const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const logFileName = () => {
  const cat = lastDone && lastDone.facts ? findCategory(lastDone.facts.category) : null;
  const label = String(cat ? categoryLabel(cat) : t('log.fileName.fallback')).replace(/[\\/:*?"<>|]/g, '');
  return t('log.fileName.log', { label });
};

$('btn-log-download').onclick = () => {
  if (!hasWorker() || !lastDone || !lastDone.hasLog) {
    addMsg('warn', t('run.needRerun'));
    return;
  }
  requestLog(getLocale());
};

// The three cells above the result: the comparison summarised as values that read at a glance
const highlightRows = (facts, tone) => {
  const rows = [];
  if (facts.compare) {
    const c = facts.compare;
    rows.push({
      k: t('highlight.winner'),
      v: t('highlight.winner.value', { matched: c.winner.matched, actual: c.winner.actual }),
      note: t('highlight.winner.note', {
        expected: c.winner.expected,
        actual: c.winner.actual,
        bad: t(c.winner.actual - c.winner.matched > 0 ? 'highlight.winner.note.bad' : 'highlight.winner.note.none', {
          count: c.winner.actual - c.winner.matched,
        }),
      }),
      tone: c.winner.matched === c.winner.actual && c.isMatch ? 'ok' : 'no',
    });
  }
  const checked = facts.fileHashes ? facts.fileHashes.checked || [] : [];
  if (checked.length > 0) {
    const bad = checked.filter((f) => f.actual !== f.expected).length + (facts.package && !facts.package.ok ? 1 : 0);
    const total = checked.length + (facts.package ? 1 : 0);
    rows.push({
      k: t(facts.package ? 'highlight.fingerprint.mass' : 'highlight.fingerprint'),
      v: bad > 0 ? t('highlight.fingerprint.no', { count: bad }) : t('highlight.fingerprint.ok', { count: total }),
      note: checked.map(fileKindLabel).join(t('sep.list')),
      tone: bad > 0 ? 'no' : 'ok',
    });
  }
  if (facts.seed) {
    const s = facts.seed;
    rows.push({
      k: t('highlight.seed'),
      v: s.note === 'noSource' ? t('highlight.seed.none') : s.match ? t('verdict.match') : t('verdict.mismatch'),
      note:
        s.note === 'noSource'
          ? t('facts.seedDerive.none')
          : seedOriginOf(s)
          ? t('highlight.seed.note.origin', { source: seedOriginOf(s).source })
          : t('highlight.seed.note', { seed: s.seed }),
      tone: s.note === 'noSource' ? 'hold' : s.match ? 'ok' : 'no',
    });
  }
  return rows.length > 0 ? rows : [{ k: t('highlight.verdict'), v: verdictLabel(lastDone.verdict), note: '', tone }];
};

// Weight source: this page does not vouch for the values themselves, so it states where they came from
const weightSourceLabel = (src) => {
  if (!src || src.kind !== 'lotteryStat') return '';
  if (!src.from || !src.to) return t('facts.weightSource.lotteryStat.noRange');
  return t('facts.weightSource.lotteryStat', { from: src.from, to: src.to });
};

// Draw information: grouped into sections by meaning rather than listed as a flat set of values
const factGroups = (facts) => {
  const d = facts.drawing || {};
  const cat = findCategory(facts.category);
  const s = facts.summary;

  const group = (title, pairs) => ({
    title: t(title),
    rows: pairs.filter(([, v]) => v != null && v !== '').map(([k, v, bad]) => [t(k), String(v), !!bad]),
  });

  const groups = [
    group('facts.group.drawing', [
      ['facts.title', d.title],
      ['facts.issue', d.reportIssueNumber],
      ['facts.datetime', d.drawingDatetime],
      ['facts.drawType', t(facts.isMass ? 'run.type.mass' : 'run.type.normal')],
      ['facts.category', cat ? categoryLabel(cat) : ''],
    ]),
    group('facts.group.seed', [
      ['facts.algorithm', facts.algorithm],
      ['facts.seed', facts.seed ? facts.seed.seed : ''],
      ['facts.seedRequestKey', facts.seedRequestKey],
      ['facts.seedDerive', facts.seed ? seedSummary(facts.seed) : '', facts.seed && facts.seed.note !== 'noSource' && !facts.seed.match],
      ['facts.sortOrder', facts.sortOrderType != null ? sortOrderLabel(facts.sortOrderType) : ''],
    ]),
    group('facts.group.result', [
      ['facts.entryCount', s ? t('facts.entryCount.value', { entry: s.entryCount, main: s.mainCount }) : ''],
      [
        'facts.preliminary',
        s
          ? s.prelimMethod
            ? t(s.prelimMethod === 'ALL' ? 'facts.preliminary.all' : 'facts.preliminary.type', { count: s.prelimCount })
            : t('facts.preliminary.none')
          : '',
      ],
      ['facts.weightSource', s ? weightSourceLabel(s.weightSource) : ''],
      ['facts.rngConsumed', facts.rngConsumed != null ? t('facts.rngConsumed.value', { count: facts.rngConsumed }) : ''],
      ['facts.drawUseRidTies', facts.drawUseRidTies ? t('facts.drawUseRidTies.value', { count: facts.drawUseRidTies }) : ''],
      [
        'facts.compare',
        facts.compare
          ? t('facts.compare.value', {
              expected: facts.compare.winner.expected,
              actual: facts.compare.winner.actual,
              matched: facts.compare.winner.matched,
            })
          : '',
        facts.compare && !facts.compare.isMatch,
      ],
      ['facts.package', facts.package ? (facts.package.ok ? t('facts.package.ok') : packageReason(facts.package)) : '', facts.package && !facts.package.ok],
    ]),
    group('facts.group.file', [
      ['facts.appVersion', facts.appVersion],
      ['facts.logicVersion', facts.logicVersion],
      ['facts.bundleFormat', facts.schemaVersion != null ? t('facts.bundleFormat.value', { schema: facts.schemaVersion }) : ''],
      ['facts.createdAt', facts.createdAt],
    ]),
  ];
  return groups.filter((g) => g.rows.length > 0);
};

const renderResult = (done) => {
  const facts = done.facts || {};
  const tone = TONE[done.verdict] || '';
  $('verdict').className = `verdict ${tone}`;
  $('verdict-glyph').textContent = GLYPH[tone] || '?';
  $('verdict-big').textContent = t('verdict.headline', { value: verdictLabel(done.verdict) });
  $('verdict-sub').textContent = verdictSub(done.verdict, facts);

  $('highlights').innerHTML = '';
  for (const h of highlightRows(facts, tone)) {
    const cell = el('div');
    cell.appendChild(el('span', 'k', h.k));
    cell.appendChild(el('span', `v ${h.tone === 'ok' ? '' : h.tone}`.trim(), h.v));
    if (h.note) cell.appendChild(el('span', 'note', h.note));
    $('highlights').appendChild(cell);
  }

  // A verdict reached without even reading the bundle has nothing to list, so no empty table is shown
  const groups = factGroups(facts);
  $('facts').innerHTML = '';
  for (const g of groups) {
    const box = el('section', 'factgroup');
    box.appendChild(el('h3', null, g.title));
    const grid = el('div', 'factrows');
    for (const [k, v, bad] of g.rows) {
      const row = el('div');
      row.appendChild(el('span', 'k', k));
      row.appendChild(el('span', bad ? 'v no' : 'v', v));
      grid.appendChild(row);
    }
    box.appendChild(grid);
    $('facts').appendChild(box);
  }
  show($('sec-summary'), groups.length > 0);
  show($('sec-log'), !!done.hasLog);

  // Schema violations are not collapsed into one line: each item is shown with its own reason
  for (const r of facts.reasons || []) addMsg('err', tm(r));
  for (const w of facts.warnings || []) addMsg('warn', tm(w));

  show($('sec-result-view'), true);
  $('sec-result-view').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ── Page chrome ──
$('copy-year').textContent = String(new Date().getFullYear());

// The language menu closes on an outside click or Esc
const languageMenu = document.querySelector('.language');
document.addEventListener('click', (e) => {
  if (!e.target.closest('.language')) languageMenu.open = false;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') languageMenu.open = false;
});

render();
setProgress(0);
