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

// Bundle verification pipeline: read the bundle, compare the package (mass draws only), check the seed derivation, reproduce, then compare results.
// ⚠ A pure module shared by the Worker and the tests. No DOM access; progress is reported only through onStage(id, info).
// ⚠ No network is used. The seed is checked against the source random value inside the bundle; the origin is never queried again.

import { readBundle } from '../bundle/readBundle.js';
import { verifyMassPackage } from '../bundle/massPackage.js';
import { deriveSeed } from '../seed/deriveSeed.js';
import { reproduce } from '../pipeline/reproduce.js';
import { unconfirmedMessage } from '../pipeline/logicVersion.js';
import { FIELD_ID } from '../pipeline/fieldId.js';
import { compare, normalizeReproduced } from '../parse/compare.js';
import { msg, messageOf } from '../msg/index.js';
import { stageList, stagePercent } from './stages.js';

/** Cancellation signal. It is never turned into a verdict; it propagates as it is. */
export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
    this.cancelled = true;
  }
}

// Verdicts. Earlier entries are stronger: when several things disagree at once, the user is shown the most fundamental cause.
export const VERDICT = {
  UNVERIFIABLE: 'unverifiable', // cannot verify: the bundle could not be read, or reproduction does not hold
  PENDING: 'pending', //          cannot judge yet: the result file could not be read in a way we understand
  SEED_MISMATCH: 'seedMismatch', // seed disagrees
  PACKAGE_MISMATCH: 'packageMismatch', // package disagrees
  MISMATCH: 'mismatch', //        results disagree
  MATCH: 'match', //              results agree
};

// ⚠ Seed and package name a definite cause, so they outrank pending. Pending itself outranks mismatch:
//   when part of the file could not be read, "the results differ" would be a claim the run cannot make.
const ORDER = [
  VERDICT.UNVERIFIABLE,
  VERDICT.SEED_MISMATCH,
  VERDICT.PACKAGE_MISMATCH,
  VERDICT.PENDING,
  VERDICT.MISMATCH,
  VERDICT.MATCH,
];

const worst = (list) => ORDER.find((v) => list.includes(v)) || VERDICT.MATCH;

// A mass draw yields winners as line numbers only, so the comparison holds only after those lines are filled in from the package
const fillMassIdentity = (winnerList, identities) => {
  let filled = 0;
  for (const w of winnerList) {
    const line = Number(w[FIELD_ID.ENTRY_ESSENTIAL_DATA]);
    const text = identities.get(line);
    if (text == null) continue;
    w[FIELD_ID.ENTRY_DATA] = text;
    w[FIELD_ID.ENTRY_DATA_ORIGINAL] = text;
    filled++;
  }
  return filled === winnerList.length && filled > 0;
};

const mismatchRows = (list, kind, limit) => {
  const out = [];
  for (const row of list.rows) {
    if (row.ok || out.length >= limit) continue;
    out.push({
      kind,
      index: row.index,
      order: row.order,
      expected: row.expected ? row.expected.entryData : null,
      actual: row.actual ? row.actual.entryData : null,
      group: row.expected ? row.expected.group : row.actual ? row.actual.group : '',
    });
  }
  return out;
};

// Entrant pairs that share a draw sort key. A tie is settled by the entry sequence, so these are the rows
// the second random number did not order — reported as a fact, never as a verdict.
const countTiePairs = (list, fieldId) => {
  const counts = new Map();
  for (const entry of list || []) {
    const key = entry[fieldId];
    if (key == null) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let pairs = 0;
  for (const n of counts.values()) if (n > 1) pairs += (n * (n - 1)) / 2;
  return pairs;
};

const MISMATCH_LIMIT = 200; // how many mismatch examples reach the screen and the log; the full count is carried in facts

/**
 * Verifies one bundle, together with the original package when it is a mass draw.
 * @param {{bundleBytes: Uint8Array, packageBytes?: Uint8Array, onStage?: (id: string, info: object) => void}} args
 * @returns {Promise<{verdict: string, facts: object, mismatches: Array, log: object}>}
 *   verdict is one of VERDICT. Failures come back as a verdict rather than an exception; only cancellation throws.
 */
export const runVerify = async ({ bundleBytes, packageBytes, onStage = () => {} }) => {
  const facts = { stages: [] };
  let stages = stageList();
  const report = (id, info) => {
    onStage(id, { percent: stagePercent(stages, id, (info && info.intra) || 0), ...(info || {}) });
  };
  const enter = (id) => {
    facts.stages.push(id);
    report(id, { intra: 0 });
  };

  // ① Bundle. If it cannot be read, the run ends right here.
  enter('bundle');
  let read;
  try {
    read = await readBundle(bundleBytes);
  } catch (e) {
    if (e && e.cancelled) throw e;
    return {
      verdict: VERDICT.UNVERIFIABLE,
      facts: { ...facts, failedStage: 'bundle', reason: messageOf(e), reasons: e.errors || null },
      mismatches: [],
      log: null,
    };
  }

  stages = stageList({ mass: read.meta.isMass });
  facts.schemaVersion = read.meta.schemaVersion;
  facts.algorithm = read.meta.setting.randomAlgorithmType;
  facts.seedRequestKey = read.meta.setting.seedRequestKey;
  facts.isMass = read.meta.isMass;
  facts.appVersion = read.meta.appVersion;
  facts.logicVersion = read.meta.logicVersion;
  facts.createdAt = read.meta.createdAt;
  facts.drawing = read.meta.drawing;
  facts.category = read.meta.category.id;
  facts.summary = read.meta.summary;
  // checked is what the screen shows as a per-file fingerprint list; the values are exactly those written in the bundle
  facts.fileHashes = {
    checked: read.fileHashes.checked.map((f) => ({ key: f.key, filename: f.filename, expected: f.expected, actual: f.actual })),
    mismatch: read.fileHashes.mismatch,
    missing: read.fileHashes.missing,
  };
  facts.warnings = [...read.meta.warnings];
  if (read.meta.appVersionUnconfirmed) facts.warnings.push(unconfirmedMessage(read.meta.appVersion));
  if (read.meta.unmappedHeaders.length > 0) {
    facts.warnings.push(msg('msg.verify.unmappedHeaders', { value: read.meta.unmappedHeaders.join(', ') }));
  }
  // A file the bundle declared but did not enclose cannot be fingerprinted at all, so nothing built on it holds
  if (read.fileHashes.missing.length > 0) {
    return {
      verdict: VERDICT.UNVERIFIABLE,
      facts: { ...facts, failedStage: 'bundle', reason: msg('msg.verify.fileMissing', { value: read.fileHashes.missing.join(', ') }) },
      mismatches: [],
      log: null,
    };
  }
  // If an enclosed file changed inside the bundle, any comparison built from it cannot be trusted
  if (read.fileHashes.mismatch.length > 0) {
    return {
      verdict: VERDICT.UNVERIFIABLE,
      facts: { ...facts, failedStage: 'bundle', reason: msg('msg.verify.fileHashMismatch', { value: read.fileHashes.mismatch.join(', ') }) },
      mismatches: [],
      log: null,
    };
  }
  report('bundle', {
    intra: 1,
    done: {
      schemaVersion: facts.schemaVersion,
      algorithm: facts.algorithm,
      isMass: facts.isMass,
      appVersion: facts.appVersion,
      logicVersion: facts.logicVersion,
      fileHashes: facts.fileHashes,
      summary: facts.summary,
    },
  });

  const candidates = [];

  // ② Package, mass draws only. A tampered package makes identity comparison meaningless, so it goes straight into the verdict.
  let identities = null;
  if (read.meta.isMass) {
    enter('package');
    if (!packageBytes || packageBytes.length === 0) {
      return {
        verdict: VERDICT.UNVERIFIABLE,
        facts: { ...facts, failedStage: 'package', reason: msg('msg.verify.packageNeeded') },
        mismatches: [],
        log: null,
      };
    }
    let pkg;
    try {
      pkg = await verifyMassPackage(packageBytes, read.mass, {
        onFile: (info) => report('package', { intra: info.total ? (info.index + 1) / info.total : 0, file: info.filename }),
      });
    } catch (e) {
      if (e && e.cancelled) throw e;
      return {
        verdict: VERDICT.UNVERIFIABLE,
        facts: { ...facts, failedStage: 'package', reason: messageOf(e) },
        mismatches: [],
        log: null,
      };
    }
    facts.package = {
      ok: pkg.ok,
      packageHashMatch: pkg.packageHashMatch,
      manifestMatch: pkg.manifestMatch,
      merkleMatch: pkg.merkleMatch,
      fileHashMismatch: pkg.fileHashMismatch.map((f) => f.filename),
      missingLines: pkg.missingLines,
    };
    identities = pkg.identities;
    if (!pkg.ok) candidates.push(VERDICT.PACKAGE_MISMATCH);
    report('package', { intra: 1, done: { package: facts.package } });
  }

  // ③ Seed derivation, offline: apply the derivation rule to the bundle's source random value and match it against the seed
  enter('seedDerive');
  const rawValue = read.meta.setting.seedRandomValue;
  const seed = String(read.meta.setting.seed == null ? '' : read.meta.setting.seed);
  const origin = { name: read.meta.setting.seedSource || null, round: read.meta.setting.seedRound || null };
  if (rawValue == null || String(rawValue) === '') {
    facts.seed = { seed, source: null, derived: null, match: null, note: 'noSource', origin };
    facts.warnings.push(msg('msg.verify.seedNoSource'));
  } else {
    const derived = String(deriveSeed(String(rawValue)));
    const match = derived === seed;
    facts.seed = { seed, source: String(rawValue), derived, match, note: null, origin };
    if (!match) candidates.push(VERDICT.SEED_MISMATCH);
  }
  report('seedDerive', { intra: 1, done: { seed: facts.seed } });

  // ④ Reproduction
  enter('reproduce');
  let reproduced;
  try {
    reproduced = reproduce(
      { ...read.input, appVersion: read.meta.appVersion },
      { onStage: (id, info) => report('reproduce', { intra: (info && info.intra) || 0, inner: id, info: info || null }) },
    );
  } catch (e) {
    if (e && e.cancelled) throw e;
    return {
      verdict: VERDICT.UNVERIFIABLE,
      facts: { ...facts, failedStage: 'reproduce', reason: messageOf(e) },
      mismatches: [],
      log: null,
    };
  }
  facts.rngConsumed = reproduced.rngConsumed;
  facts.sortOrderType = reproduced.sortOrderType;
  facts.reproducedCounts = {
    winner: (reproduced.winnerList || []).filter((w) => !w.isPreliminary).length,
    prelim: (reproduced.winnerList || []).filter((w) => !!w.isPreliminary).length,
  };

  // Ball-number draws sort by drawUseRid = last8(rid x ball number). A ball number divisible by 2 or 5
  // shrinks that value space, so ties get more likely — count them here and leave the draw logic alone.
  if ((read.input.setting.categoryInfo || {}).isBallNumberInputDrawing) {
    facts.drawUseRidTies = countTiePairs(reproduced.entryList, FIELD_ID.DRAW_USE_R_ID);
  }
  report('reproduce', {
    intra: 1,
    done: { rngConsumed: facts.rngConsumed, sortOrderType: facts.sortOrderType, reproducedCounts: facts.reproducedCounts },
  });

  // ⑤ Comparison
  enter('compare');
  let identityCompared = true;
  if (read.meta.isMass) identityCompared = fillMassIdentity(reproduced.winnerList, identities || new Map());

  const reproducedRows = normalizeReproduced(reproduced.winnerList, { isMatchDraw: read.meta.isMatchDraw });
  const result = compare(reproducedRows, read.expected.rows);
  facts.compare = { isMatch: result.isMatch, ...result.summary, identityCompared };

  // The draw picked backup winners, yet not a single backup label could be read from the result file. That is unreadable, not a mismatch.
  const prelimUnreadable = read.meta.prelimExpected && !read.meta.prelimSeen;
  if (prelimUnreadable) {
    facts.pendingReason = msg('msg.verify.prelimLabelUnknown');
    candidates.push(VERDICT.PENDING);
  }
  // In a mass draw, if not every winning line got its identity, what was compared is not identity
  if (!identityCompared) {
    facts.pendingReason = msg('msg.verify.identityUnavailable');
    candidates.push(VERDICT.PENDING);
  }
  // Nothing to compare on either side (main or backup) is not a match — it is nothing having been checked
  const nothingToCompare =
    result.winner.expectedTotal === 0 && result.winner.actualTotal === 0 && result.preliminary.expectedTotal === 0 && result.preliminary.actualTotal === 0;
  if (nothingToCompare) {
    facts.pendingReason = msg('msg.verify.noWinnersToCompare');
    candidates.push(VERDICT.PENDING);
  }
  if (!result.isMatch) candidates.push(VERDICT.MISMATCH);
  report('compare', { intra: 1, done: { compare: facts.compare } });

  const mismatches = mismatchRows(result.winner, 'winner', MISMATCH_LIMIT).concat(
    mismatchRows(result.preliminary, 'preliminary', MISMATCH_LIMIT),
  );

  return {
    verdict: worst(candidates),
    facts,
    mismatches,
    // The detailed log is built only when asked for: carrying every entrant in the result would blow up memory on a large draw
    log: { category: read.meta.category, seed, algorithm: read.meta.setting.randomAlgorithmType, form: read.input.setting, reproduced, compare: result, identityCompared },
  };
};
