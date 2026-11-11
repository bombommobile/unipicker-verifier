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

// Korean UI strings — human-readable text only.
// ⚠ Korean tokens that split uploaded files (backup-winner prefixes, the "all" label, class, group, weight,
//   winnable count and the like) never go here.
//   Those literals live in parse/ · pipeline/ so every language reads the same file the same way.

export const ko = {
  // ── Document and metadata ──
  'app.title': '유니피커 공정 추첨 검증기 — 검증 파일 하나로 추첨 결과를 확인합니다',
  'app.brand': '추첨 검증기',
  'meta.description': '추첨 결과 폴더에 저장된 검증 파일을 올리면 그 추첨을 브라우저 안에서 그대로 다시 실행해 결과가 같은지 확인합니다. 파일은 서버로 전송되지 않습니다.',

  // ── Header ──
  'hero.title': '유니피커의 추첨 소스코드를 공개한',
  'hero.title.accent': '공정 추첨 검증기',
  'hero.lead':
    '추첨 후 자동 생성되는 검증 파일로 추첨을 재현하여 기존 결과와 일치하는지 확인할 수 있습니다.<br>' +
    '검증기가 사용하는 추첨 로직은 유니피커 소프트웨어의 실제 추첨 로직과 동일하며,<br>' +
    'GitHub에 공개되어 있어 누구나 직접 확인할 수 있습니다.',
  'hero.cta': 'GitHub 소스 저장소',
  'hero.start': '검증 시작하기',
  'hero.noticeBadge': '안내',
  'a11y.skip': '본문으로 건너뛰기',
  'hero.notice': '공개 검증기는 <b>UniPicker 5.1 버전 이상</b>에서 진행한 추첨만 이용할 수 있습니다. 이전 버전 추첨의 검증이 필요한 경우, 고객센터로 문의해 주세요.',

  // ── Footer ──
  'footer.support': '고객센터 <b>1666-2370</b> · <a href="mailto:cs@bbmobile.co.kr">cs@bbmobile.co.kr</a>',

  // ── Language ──
  'lang.label': '언어 선택',

  // ── Category groups ──
  'categoryGroup.general': '일반',
  'categoryGroup.entryType': '그룹별',
  'categoryGroup.mo': '실시간 문자 응모',
  'categoryGroup.luckyNumber': '행운번호',
  'categoryGroup.presale': '부동산 분양',
  'categoryGroup.gift': '기프트콘',
  'categoryGroup.mass': '대량 (상생페이백)',

  // ── Category labels ──
  'category.GENERAL_DEFAULT': '당첨자 추첨 (기본)',
  'category.GENERAL_RANK_WEIGHT': '가중치 당첨자 추첨',
  'category.GENERAL_RANK': '등수·경품·그룹 배정 추첨',
  'category.GENERAL_RANK_SLOT': '당첨자 롤링 화면 추첨',
  'category.GENERAL_RANK_BALL_NUMBER_INPUT': '공 번호 입력 공개추첨',
  'category.GENERAL_ORDER': '순번 배정 추첨',
  'category.GENERAL_MATCH': '대진·짝 추첨',
  'category.GENERAL_SEAT_ASSIGNMENT': '자리 배정 추첨',
  'category.GENERAL_ENTRY_TYPE_WINNER': '그룹별 당첨자 추첨',
  'category.GENERAL_ENTRY_TYPE_ORDER': '그룹별 순번 배정 추첨',
  'category.GENERAL_ENTRY_TYPE_MATCH': '그룹별 대진·짝 추첨',
  'category.GENERAL_ENTRY_TYPE_SEAT_ASSIGNMENT': '그룹별 자리 배정 추첨',
  'category.GENERAL_ENTRY_TYPE_GROUP': '그룹별 하위그룹 배정 추첨',
  'category.GENERAL_ENTRY_TYPE_COMPANION': '그룹별 하위그룹 동반배정 추첨',
  'category.MO_DEFAULT': '문자 응모 당첨자 추첨',
  'category.MO_RANK': '문자 응모 등수별 당첨자 추첨',
  'category.MO_RANK_SLOT': '문자 응모 당첨자 롤링 화면 추첨',
  'category.LUCKY_NUMBER': '행운번호 추첨',
  'category.LUCKY_NUMBER_RANK': '등수별·그룹별 행운번호 추첨',
  'category.BALL_DRAW': '공 뽑기 추첨',
  'category.BALL_DRAW_ENTRY': '공 뽑기 추첨 + 응모자명 입력형',
  'category.LOTTERY_NUMBER': '로또번호 추첨',
  'category.LOTTERY_NUMBER_GENERATOR': '로또번호 생성기',
  'category.PRESALE_BLOCK_UNIT': '동호수 지정추첨',
  'category.PRESALE_PRELIMINARY_ORDER': '예비자 순번추첨',
  'category.PRESALE_ROOM_DISTRIBUTION': '호실 배분 추첨',
  'category.GIFT_DEFAULT': '기프트콘 당첨자 추첨 (기본)',
  'category.GIFT_RANK': '기프트콘 등수별 당첨자 추첨',
  'category.GIFT_RANK_WEIGHT': '기프트콘 가중치 당첨자 추첨',
  'category.GENERAL_DEFAULT_MASS': '대량 당첨자 추첨 (기본)',
  'category.GENERAL_RANK_MASS': '대량 등수별 당첨자 추첨',
  'category.GENERAL_ORDER_MASS': '대량 순번 배정 추첨',

  // ── Stages ──
  'stage.bundle': '검증 파일 확인',
  'stage.package': '원본 패키지 대조',
  'stage.seedDerive': '시드 대조',
  'stage.reproduce': '추첨 재현',
  'stage.compare': '결과 대조',
  // Inner reproduction steps, showing where the long stage currently is
  'stage.rid': '난수 부여',
  'stage.sort': '정렬',
  'stage.draw': '당첨',
  'stage.prelim': '예비',

  // Per-stage description: what a pending stage will do, and what a finished one checked
  'stage.bundle.detail': '파일 구성과 형식, 추첨에 쓰인 프로그램 버전, 파일 지문, 응모자 · 결과 파일을 확인합니다.',
  'stage.bundle.doneFacts': '파일 형식 v{schema} · 유니피커 {app} · 파일 지문 일치',
  'stage.package.detail': '원본 응모자 패키지로 당첨 줄의 응모자 정보를 대조합니다.',
  'stage.package.doneFacts': '당첨 줄 응모자 정보 · 패키지 지문 일치',
  'stage.seedDerive.detail': '원천 난수값으로 시드를 다시 계산해 비교합니다.',
  'stage.reproduce.detail': '난수 부여 → 정렬 → 당첨 · 예비 선정 순서로 다시 실행합니다.',
  'stage.reproduce.doneFacts': '당첨 {winner}명 재현',
  'stage.reproduce.doneFacts.prelim': '당첨 {winner}명 · 예비당첨자 {prelim}명 재현',
  'stage.compare.detail': '재현 결과와 검증 파일에 담긴 실제 결과를 비교합니다.',
  'stage.compare.doneFacts': '당첨 {winner}명 전부 동일',
  'stage.compare.doneFacts.prelim': '당첨 {winner}명 · 예비당첨자 {prelim}명 전부 동일',
  'stage.compare.doneFacts.partial': '당첨 {actual}명 중 {matched}명 동일',

  // Values produced by the inner reproduction steps
  'ticker.entry': '응모자 {count}명',
  'ticker.sort': '난수 {dir}',
  'ticker.count': '{count}명',
  'ticker.busy': '진행 중…',

  // ── ① Verification file upload ──
  'step.upload.title': '검증 파일 업로드',
  'step.upload.detail.empty': '추첨 완료 후 생성된 추첨검증.zip 파일을 업로드해 주세요.',
  'step.upload.detail.filled': '파일이 준비되었습니다.',
  'step.upload.detail.mass': '대량 추첨 검증 파일입니다.',
  'step.upload.dropTitle': '추첨검증.zip을 여기에 끌어다 놓으세요',
  'step.upload.dropDesc': '추첨 완료 시 유니피커가 자동으로 생성해 주는 파일로, 유니피커 추첨 결과 폴더에서 확인할 수 있습니다.',

  // ── ② Original entrant package upload (mass-draw bundles only) ──
  'step.package.title': '원본 응모자 패키지 업로드',
  'step.package.detail.pending': '검증 파일을 먼저 올려 주세요.',
  'step.package.detail.empty': '대량 추첨 검증입니다. 당첨 줄의 응모자 정보를 대조하려면 추첨에 사용한 원본 응모자 패키지 zip이 필요합니다.',
  'step.package.detail.filled': '원본 응모자 패키지가 준비되었습니다.',
  'step.package.dropTitle': '원본 응모자 패키지 zip을 여기에 끌어다 놓으세요',
  'step.package.dropDesc': '추첨에 사용한 원본 응모자 패키지입니다. 당첨 줄의 응모자 정보를 대조하는 데 사용합니다.',

  // ── Shared upload strings ──
  'drop.pick': '파일 선택',
  'drop.privacy': '업로드한 파일은 서버로 전송되지 않으며, 모든 검증은 브라우저에서 안전하게 진행됩니다.',
  'file.kind.zip': 'ZIP',
  'file.kind.pkg': 'PKG',
  'file.change': '파일 변경',
  'file.hash.ok': '✓ 일치',
  'file.hash.no': '✕ 불일치',
  'file.size.mb': '{value} MB',
  'file.size.kb': '{value} KB',
  'file.dropRejected': '{accept} 파일만 올릴 수 있습니다.',
  'file.readFailed': '파일을 읽지 못했습니다.',

  // ── Run and progress ──
  'section.run.title': '검증 추첨 진행',
  'run.type.normal': '일반 추첨',
  'run.type.mass': '대량 추첨',
  'run.percent': '{pct}%',
  'run.start': '검증 시작',
  'run.startHint': '대량 추첨은 원본 응모자 패키지까지 올려야 검증할 수 있습니다.',
  'run.busy': '검증 중',
  'run.busyHint': '잠시만 기다려 주세요. 페이지를 닫으면 검증이 중단됩니다.',
  'run.cancel': '취소',
  'run.cancelled': '검증을 취소했습니다.',
  'run.error.workerUnsupported': '이 브라우저는 지원되지 않습니다(모듈 Web Worker 필요).',
  'run.error.workerLoadFailed': '검증 모듈을 불러오지 못했습니다 — 페이지를 새로고침한 뒤 다시 시도해 주세요.',
  'run.error.runFailed': '검증 실행 중 오류가 발생했습니다: {message}',
  'run.needRerun': '검증을 다시 실행한 뒤 이용해 주세요.',
  'run.again': '다른 파일 검증',
  'error.bundleNeeded': '추첨검증.zip 파일을 올려 주세요.',

  // ── Stage status ──
  'status.pending': '대기',
  'status.active': '진행 필요',
  'status.running': '진행 중',
  'status.done': '완료',

  // ── Verdict and summary ──
  'section.summary.title': '추첨 정보',
  'facts.group.drawing': '추첨',
  'facts.group.seed': '난수와 시드',
  'facts.group.result': '재현과 대조',
  'facts.group.file': '검증 파일',
  'verdict.headline': '검증 결과 · {value}',
  'highlight.winner': '당첨자 대조',
  'highlight.winner.value': '{matched} / {actual}명 일치',
  'highlight.winner.note': '재현 {expected}명 · 파일 {actual}명 · {bad}',
  'highlight.winner.note.none': '불일치 없음',
  'highlight.winner.note.bad': '불일치 {count}명',
  'highlight.fingerprint': '파일 지문',
  'highlight.fingerprint.mass': '파일 · 패키지 지문',
  'highlight.fingerprint.ok': '{count}개 모두 일치',
  'highlight.fingerprint.no': '{count}개 불일치',
  'highlight.seed': '시드 원천',
  'highlight.seed.none': '대조 없음',
  'highlight.seed.note': '원천 난수값에서 파생한 시드 {seed}',
  'highlight.seed.note.origin': '{source} 에서 파생',
  'highlight.verdict': '판정',
  'verdict.match': '일치',
  'verdict.mismatch': '불일치',
  'verdict.pending': '판정 보류',
  'verdict.unverifiable': '검증 불가',
  'verdict.packageMismatch': '패키지 불일치',
  'verdict.seedMismatch': '시드 불일치',
  'verdict.match.sub': '재현 결과가 추첨결과 파일과 정확히 일치합니다 · 당첨 {winner}명 전원 일치',
  'verdict.match.sub.prelim': ' · 예비당첨자 {prelim}명 전원 일치',
  'verdict.mismatch.sub': '재현 결과가 추첨결과 파일과 다릅니다 · 당첨 {actual}명 중 {matched}명 일치',
  'verdict.mismatch.sub.prelim': ' · 예비 {actual}명 중 {matched}명 일치',
  'verdict.seedMismatch.sub': '검증 파일의 원천 난수값에서 파생한 시드({derived})가 추첨에 쓴 시드({seed})와 다릅니다.',
  'verdict.packageMismatch.sub': '올린 원본 패키지가 추첨에 쓴 것과 다릅니다 — {reason}.',
  'facts.title': '추첨명',
  'facts.issue': '이력 번호',
  'facts.datetime': '추첨 일시',
  'facts.drawType': '추첨 방식',
  'facts.category': '추첨 카테고리',
  'facts.seed': '시드',
  'facts.seedRequestKey': '시드 요청키',
  // Each source counts in its own unit: Drand in rounds, NIST in pulse indexes, named as the source names them
  'seed.origin.drand': 'Drand Round {round}',
  'seed.origin.nist': 'NIST Pulse Index {round}',
  'facts.seedDerive': '시드 원천 대조',
  'facts.seedDerive.match': '원천 난수값에서 파생한 시드와 일치',
  'facts.seedDerive.match.origin': '{source} 에서 파생한 시드와 일치',
  'facts.seedDerive.match.summary': '{source} 의 원천 난수값에서 파생한 시드와 일치',
  'facts.seedDerive.mismatch': '원천 난수값에서 파생한 시드({derived})와 다름',
  'facts.seedDerive.mismatch.origin': '{source} 에서 파생한 시드({derived})와 다름',
  'facts.seedDerive.mismatch.summary': '{source} 의 원천 난수값에서 파생한 시드({derived})와 다름',
  'facts.seedDerive.none': '검증 파일에 원천값이 없어 대조하지 않음',
  'facts.package': '원본 패키지 대조',
  'facts.package.ok': '파일 해시 · 매니페스트 · 머클루트 모두 일치',
  'facts.package.hash': '패키지 해시 불일치',
  'facts.package.manifest': '매니페스트 불일치',
  'facts.package.merkle': '머클루트 불일치',
  'facts.package.files': '파일 {count}개 해시 불일치',
  'facts.package.lines': '당첨 줄 {count}개를 패키지에서 찾지 못함',
  'facts.appVersion': '앱 버전',
  'facts.logicVersion': '추첨 로직 버전',
  'facts.algorithm': '난수 알고리즘',
  'facts.bundleFormat': '검증 파일 형식',
  'facts.bundleFormat.value': 'unipicker-verify-bundle v{schema}',
  // Kinds of enclosed file, used in the summary cells in place of a file name
  'facts.file.entry': '응모자정보',
  'facts.file.winSetting': '추첨정보',
  'facts.file.result': '추첨결과',
  'facts.sortOrder': '정렬 방향',
  'facts.entryCount': '응모자 · 추첨수',
  'facts.weightSource': '가중치',
  'facts.weightSource.lotteryStat': '로또 번호별 당첨횟수 ({from}회~{to}회 집계)',
  'facts.weightSource.lotteryStat.noRange': '로또 번호별 당첨횟수 (집계 회차 미상)',
  'facts.entryCount.value': '{entry}명 · {main}',
  'facts.preliminary': '예비당첨자',
  'facts.preliminary.all': '전원 {count}명',
  'facts.preliminary.type': '그룹별 {count}명',
  'facts.preliminary.none': '사용 안 함',
  'facts.rngConsumed': '소비한 난수',
  'facts.rngConsumed.value': '{count}개',
  'facts.drawUseRidTies': '2차 난수 동점',
  'facts.drawUseRidTies.value': '{count}건 — 동점은 입력 순번으로 정렬됨',
  'facts.compare': '당첨자 대조',
  'facts.compare.value': '재현 {expected}명 · 파일 {actual}명 · 일치 {matched}명',
  'facts.createdAt': '검증 파일 생성',
  // The seed source is never queried again; the page only names where it can be checked by hand (written without a scheme so it does not become a link)
  'seedOrigin.offlineNote':
    '시드 원천값은 발행처(drand · NIST 랜덤니스 비콘)에서 직접 확인할 수 있습니다.<br>' +
    '이 페이지는 네트워크 요청을 하지 않으므로, 시드 대조는 검증 파일에 담긴 원천값으로만 진행했습니다.',

  // ── Detailed log section ──
  'section.log.caution': '응모자 전원의 정보와 난수가 담깁니다. 파일 공유에 주의해 주세요.',
  'log.download': '상세 로그 내려받기',
  'log.downloadButton': '내려받기',
  'log.fileName.log': '추첨재현_상세로그_{label}.txt',
  'log.fileName.fallback': '추첨',

  // ── Detailed log contents ──
  'log.title': '유니피커 추첨 재현 검증기 — 상세 재현 로그',
  'log.category': '추첨 카테고리: {value}',
  'log.seed': '시드: {value}',
  'log.algorithm': '난수 생성 알고리즘: {value}',
  'log.sortOrder': '정렬 방향: {value}',
  'log.rngConsumed': '소비한 난수 개수: {value}',
  'log.winnerCounts': '당첨자: 재현 {expected}명 · 결과 파일 {actual}명 · 일치 {matched}명',
  'log.preliminaryCounts': '예비당첨자: 재현 {expected}명 · 결과 파일 {actual}명 · 일치 {matched}명',
  'log.verdict': '판정: {value}',
  'log.privacyNotice': '※ 이 파일에는 당첨자뿐 아니라 응모자 전원의 정보와 난수가 담깁니다. 공유에 주의하세요.',
  'log.entryTableTitle': '[응모자별 난수와 추첨 결과]',
  'log.drawLogTitle': '[추첨 진행 로그]',
  'log.col.seq': '응모순서',
  'log.col.entryType': '그룹',
  'log.col.entryData': '응모자정보',
  'log.col.rid': '1차 난수(rid)',
  'log.col.ballNumber': '공 번호',
  'log.col.drawRid': '2차 난수',
  'log.col.drawUseRid': '당첨 난수',
  'log.col.weight': '가중치',
  'log.col.shuffleOrder': '셔플 순서',
  'log.col.weightKey': '가중치 키',
  'log.col.isWinner': '당첨',
  'log.col.winnerOrder': '당첨 순번',
  'log.col.winnerGroup': '당첨 그룹',
  'log.col.isPreliminary': '예비',

  // ── Sort direction wording ──
  'sortOrder.asc': '오름차순',
  'sortOrder.desc': '내림차순',
  'sortOrder.bySeed': '시드',
  'sortOrder.byBall': '공 번호',
  'sortOrder.odd': '홀수',
  'sortOrder.even': '짝수',
  'sortOrder.derived': '{dir} ({what} 마지막 글자 {last} {parity})',
  'sortOrder.nonNumeric': "{dir} ({what} 마지막 글자 '{last}' — 숫자가 아니어서 오름차순)",

  // ── Messages the pure modules (parser, engine) pass as codes ──
  // ⚠ Column names written here are explanations for a reader; the literals that actually split files live in bundle/schema.js

  // Upload prompts: the screen check and the run stage use the same codes
  'msg.file.entry': '응모자 파일을 업로드해 주세요.',
  'msg.file.entryZip': '대량추첨 원본 zip 파일을 업로드해 주세요.',
  'msg.file.winSetting': '추첨설정 파일을 업로드해 주세요. 이 카테고리는 직접 입력을 지원하지 않습니다.',
  'msg.file.result': '추첨결과 파일을 업로드해 주세요.',

  // Parser
  'msg.parse.worksheetMissing': '워크시트를 찾지 못했습니다(.xlsx 형식이 아닐 수 있습니다).',
  'msg.parse.categoryColumnMismatch': '파일 열 구성이 선택한 카테고리와 다릅니다(응모자 열을 찾지 못했습니다).',

  // Verification stages
  'msg.verify.fileHashMismatch': '검증 파일에 동봉된 파일이 기록된 해시와 다릅니다: {value}',
  'msg.verify.packageNeeded': '대량추첨 검증 파일입니다 — 원본 응모자 패키지 zip 을 함께 올려 주세요.',
  'msg.verify.seedNoSource': '검증 파일에 시드 원천값이 없어 시드 파생은 대조하지 않았습니다(재현 대조로 판정했습니다).',
  'msg.verify.prelimLabelUnknown': '예비당첨자를 뽑은 추첨인데 결과 파일에서 예비당첨자 표시를 읽지 못했습니다 — 판정을 보류합니다.',
  'msg.verify.identityUnavailable': '당첨 줄의 응모자 정보를 모두 읽지 못해 신원 대조가 성립하지 않습니다 — 판정을 보류합니다.',
  'msg.verify.noWinnersToCompare': '대조할 당첨자가 한 명도 없어 판정을 보류합니다.',
  'msg.verify.fileMissing': '검증 파일이 담고 있다고 적은 파일이 실제로는 없습니다: {value}',
  'msg.verify.unmappedHeaders': '뜻을 알 수 없는 열이 있어 그 값은 쓰지 않았습니다: {value}',

  // Verification bundle zip
  'msg.bundle.empty': '검증 파일이 비어 있습니다.',
  'msg.bundle.notZip': '검증 파일이 zip 파일이 아닙니다.',
  'msg.bundle.jsonMissing': '검증 파일 안에서 verification.json 을 찾지 못했습니다 — 추첨검증 zip 이 아닙니다.',
  'msg.bundle.invalidJson': 'verification.json 을 해석할 수 없습니다(JSON 형식 오류).',
  'msg.bundle.notObject': 'verification.json 의 내용이 올바른 형태가 아닙니다.',
  'msg.bundle.schema': '검증 파일 규격이 아닙니다: {value} (기대: {expected})',
  'msg.bundle.schemaVersion': '지원하지 않는 검증 파일 규격 판(schemaVersion)입니다: {value} (지원: {expected})',
  'msg.bundle.fieldMissing': 'verification.json 에 필수 항목이 없습니다: {field}',
  'msg.bundle.fieldType': 'verification.json 항목의 형태가 올바르지 않습니다: {field} ({type} 이어야 합니다)',
  'msg.bundle.winSettingEmpty': 'verification.json 의 추첨설정 목록(winSettingList)이 비어 있습니다.',
  'msg.bundle.winSettingRow': '추첨설정 목록 {index}번째 항목이 올바른 형태가 아닙니다.',
  'msg.bundle.winSettingCount': '추첨설정 목록 {index}번째 항목에 추첨수(winCount)가 없습니다.',
  'msg.bundle.fileEntry': '동봉 파일 정보가 올바른 형태가 아닙니다: {key}',
  'msg.bundle.fileFilename': '동봉 파일 정보에 파일명이 없습니다: {key}',
  'msg.bundle.fileSha256': '동봉 파일 정보에 해시(sha256)가 없습니다: {key}',
  'msg.bundle.fileHeaderMap': '동봉 파일 정보에 열 이름 대응표(headerMap)가 없습니다: {key}',
  'msg.bundle.unknownCategory': '검증기가 지원하지 않는 추첨 카테고리입니다: {value}',
  'msg.bundle.entryFileMissing': '검증 파일 안에서 응모자 파일을 찾지 못했습니다.',
  'msg.bundle.resultFileMissing': '검증 파일 안에서 추첨결과 파일을 찾지 못했습니다.',
  'msg.bundle.entryNoColumn': '응모자 파일에서 응모자 정보 열을 찾지 못했습니다(headerMap 과 열 이름이 어긋납니다).',
  'msg.bundle.resultNoColumn': '추첨결과 파일에서 당첨자 정보 열을 찾지 못했습니다(headerMap 과 열 이름이 어긋납니다).',
  'msg.bundle.massJsonMissing': '대량추첨 검증 파일인데 mass.json 이 없습니다.',
  'msg.bundle.massJsonInvalid': 'mass.json 을 해석할 수 없습니다(JSON 형식 오류).',
  'msg.bundle.massNoTotalLines': 'mass.json 에 응모자 전체 줄 수(totalLines)가 없습니다.',
  'msg.bundle.csvAmbiguous': '{filename} 의 {count}개 줄에서 열 수가 머리글과 다릅니다 — 값에 쉼표가 들어가 열이 밀렸습니다. 이 파일은 뜻을 확정할 수 없어 검증하지 않습니다.',
  'msg.bundle.inputInvalid': '검증 파일의 값으로는 재현 입력을 만들 수 없습니다.',
  'msg.bundle.weightTotalMismatch': '검증 파일에 적힌 가중치 총합({declared})이 응모자 파일에서 다시 더한 값({actual})과 다릅니다.',

  // Original mass-draw package zip
  'msg.package.empty': '대량추첨 원본 패키지 zip 이 비어 있습니다.',
  'msg.package.massJsonNoManifest': '검증 파일에 대량추첨 패키지 정보(mass.json 의 manifest)가 없습니다.',
  'msg.package.manifestMissing': '패키지 zip 안에서 manifest.json 을 찾지 못했습니다.',
  'msg.package.manifestInvalidJson': '패키지의 manifest.json 을 해석할 수 없습니다(JSON 형식 오류).',
  'msg.package.manifestSchema': '지원하지 않는 매니페스트 스키마입니다: {value}',
  'msg.package.manifestNoFiles': '패키지의 manifest.json 에 files 목록이 없습니다.',

  // Input assembly checks
  'msg.input.category': '추첨 카테고리를 선택해 주세요.',
  'msg.input.seed': '시드를 입력해 주세요.',
  'msg.input.algorithm': '난수 생성 알고리즘을 선택해 주세요.',
  'msg.input.manifestLinesMismatch': 'manifest 의 totalLines({total})와 파일별 줄 수 합({sum})이 다릅니다.',
  'msg.input.manifestZeroLines': 'manifest 의 전체 줄 수(totalLines)가 0입니다.',
  'msg.input.entryEmpty': '응모자 파일에 데이터가 없습니다.',
  'msg.input.entryNeedGroup': "그룹별 추첨은 응모자 파일에 '그룹' 열이 필요합니다.",
  'msg.input.entryNeedWeight': "가중치 추첨은 응모자 파일에 숫자 '가중치' 열이 필요합니다(빈 값 불가).",
  'msg.input.entryNeedCompanion': "동반배정 추첨은 응모자 파일에 숫자 '당첨 가능 개수' 열이 필요합니다(빈 값 불가).",
  'msg.input.weightZero': '가중치가 0 이하인 응모자는 당첨될 수 없습니다.',
  'msg.input.drawingCount': '추첨수를 1 이상의 정수로 입력해 주세요.',
  'msg.input.prelimCount': '예비당첨자 수를 1 이상의 정수로 입력해 주세요.',
  'msg.input.winSettingEmpty': '추첨설정 파일에 데이터가 없습니다.',
  'msg.input.winSettingShape': '추첨설정 파일의 열 구성이 카테고리({category})와 다릅니다.',
  'msg.input.winSettingPrelimOrder': "분류별 예비자 순번추첨은 추첨설정 파일이 필요합니다. 전체(통합)로 뽑았다면 순번 지정 방법을 '전체'로 선택해 주세요.",
  'msg.input.winSettingPrelimPrefix': "추첨설정 파일의 분류가 '예비당첨자'로 시작해 예비 행과 구분할 수 없습니다.",
  'msg.input.winSettingPrelimAll': "업로드한 추첨설정 파일은 전체(통합) 방식입니다. 순번 지정 방법을 '전체'로 선택해 주세요.",
  'msg.input.prelimUnexpected': '이 카테고리는 예비당첨자를 사용하지 않지만 설정 파일에 예비 행이 있습니다. 파일 기준으로 재현합니다.',
  'msg.input.prelimMethodMismatch': '설정 파일의 예비당첨자 방식({method})이 카테고리 기대({expected})와 다릅니다. 파일 기준으로 재현합니다.',
  'msg.input.ballNumber': '공 번호를 숫자로 입력해 주세요.',
  'msg.input.dupFixed': '전체(통합) 방식 예비자 순번추첨은 1인 당첨 개수 제한을 고를 수 없습니다. 앱과 같게 중복 당첨 불가로 재현합니다.',
  'msg.input.dupCountGroup': '당첨 그룹 개수 제한을 1 이상의 정수로 입력해 주세요.',
  'msg.input.dupCount': '최대 당첨 가능 개수를 1 이상의 정수로 입력해 주세요.',
  'msg.input.resultEmpty': '추첨결과 파일에 데이터가 없습니다.',
  'msg.input.overTotalLines': '추첨수({count})가 전체 줄 수({total})보다 많습니다.',
  'msg.input.overCompanion': '추첨수({count})가 당첨 가능 개수 총합({available})보다 많습니다. 모자란 만큼 당첨자가 줄어듭니다.',
  'msg.input.overEntry': '추첨수({count})가 응모자 수({entry})보다 많습니다. 모자란 만큼 당첨자가 줄어듭니다.',
  'msg.input.overLuckyRange': '추첨수({count})가 번호 범위의 개수({entry})보다 많습니다.',
  'msg.input.luckyRange': '행운번호 범위가 없거나 잘못됐습니다. 시작은 1 이상, 끝은 시작 이상인 정수여야 합니다.',
  'msg.input.lotteryStat': '로또 가중치 추첨인데 번호별 당첨횟수가 번호 범위 끝까지 채워져 있지 않습니다.',

  // Uploaded-file summary: each item is a complete phrase on its own, so the screen joins them with sep.list

  // Logic version ranges
  'msg.logicVersion.badFormat': '버전 형식을 해석할 수 없습니다.',
  'msg.logicVersion.unknownId': '알 수 없는 추첨 로직 버전입니다: {value}',
  'msg.logicVersion.notRegistered': '등록되지 않은 추첨 로직 버전입니다: {value}',
  'msg.logicVersion.appVersionMissing': '검증 파일에 앱 버전이 없어 어느 시점의 로직으로 재현할지 정할 수 없습니다.',
  'msg.logicVersion.badAppVersion': '앱 버전 형식을 해석할 수 없습니다: {value}',
  'msg.logicVersion.belowMin': '검증기는 앱 {min} 이상에서 실행한 추첨만 검증합니다 (입력: {value}).',
  'msg.logicVersion.noMatch': '적용할 추첨 로직 버전을 찾지 못했습니다: {value}',
  'msg.logicVersion.unconfirmed':
    '앱 {appVersion} 은 이 검증기가 아직 로직 동일성을 확인하지 않은 버전입니다 ' +
    '(확인된 마지막 버전: {confirmed}). 일치하면 정상이지만, 불일치가 나오면 ' +
    '추첨이 조작됐다는 뜻이 아니라 검증기가 아직 갱신되지 않았을 수 있습니다.',

  // ── Separator between complete phrases ──
  'sep.list': ' · ',
};
