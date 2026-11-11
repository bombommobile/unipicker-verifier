# 유니피커 공정 추첨 검증기

완료된 추첨을 브라우저 안에서 다시 실행해 결과가 일치하는지 확인하는 정적 페이지입니다. 추첨
결과와 함께 저장된 검증 파일 하나만 올리면 됩니다. 설치, 로그인, 설정이 필요 없으며
**어떤 파일도 서버로 전송되지 않습니다**.

## 시작하기

**추첨을 검증하려면** 공개 페이지를 엽니다.
<https://www.unipicker.com/drawing/verifier/>
검증 파일을 페이지에 끌어다 놓고 [검증] 버튼을 누릅니다.
영문 페이지는 <https://www.unipicker.com/drawing/verifier/en/> 에 있습니다.

검증 파일의 이름은 추첨을 실행한 앱의 화면 언어를 따릅니다. 한국어 앱은
`추첨검증_2026-09-07-15-30-12.zip` 처럼, 영어 앱은 `draw_verification_2026-09-07-15-30-12.zip`
처럼 저장합니다. 검증기는 파일 이름을 보지 않으므로 이름을 바꿔 두었더라도 그대로 올리면 됩니다.

이 저장소의 소스는 읽는 용도로만 공개합니다. 클론해서 실행하거나 빌드하거나 테스트하도록
구성되어 있지 않으며, 추첨 검증은 위의 공개 페이지에서 수행합니다. [라이선스](#라이선스)를
확인하십시오.

## 이 검증기가 지키는 규칙

1. **빌드 단계와 런타임 의존성이 없습니다.** 제3자 라이브러리는 고정된 버전으로 `vendor/`
   아래에 원본 그대로 포함되어 있습니다.
2. **네트워크를 호출하지 않습니다.** `fetch`, `XMLHttpRequest`, `WebSocket`, CDN, 외부 폰트를
   어느 것도 사용하지 않습니다. 시드 원천을 다시 조회하지 않으며, 검증 파일에 담긴 원천 난수값에
   파생 규칙을 적용해서 전부 오프라인으로 대조합니다.
3. **`pipeline/v1/` 은 첫 공개 릴리스 이후로 변경하지 않습니다.** 한번 배포된 버전의 폴더는
   앱의 추첨 로직이 바뀌어도 그대로 두고, 대신 `pipeline/v2/` 를 새로 만들어 `LOGIC_VERSIONS`
   에 등록합니다. 과거에 실행된 추첨은 그 시점에 적용되던 로직으로 계속 재연되어야 하기
   때문입니다. (첫 릴리스 이전에 적용한 변경은 이 규칙을 어기지 않습니다. 릴리스 전 로직으로
   재연해야 하는 과거 추첨이 아직 없기 때문입니다.)
4. **결과를 바꿀 수 있는 값은 모두 대조합니다.** 판정할 수 없는 항목이 하나라도 있으면 통과로
   처리하지 않습니다. 검증 파일을 읽지 못했으면 "검증 불가"로 끝내고, 읽기는 했으나 대조가
   성립하지 않으면 "판정 보류"로 남깁니다 — 어느 쪽도 일치로 세지 않습니다.
5. **언어는 화면 표시에만 영향을 줍니다.** URL 이 언어를 결정합니다. `/verifier/` 은
   한국어이고 `/verifier/en/` 은 영어입니다. 업로드한 파일을 분류할 때 쓰는 한국어
   토막은 메시지 사전이 아니라 `parse/` 와 `pipeline/` 안에 리터럴로 두었으므로, 화면 언어가
   판정을 바꾸지 못합니다.

## 한계

- **검증 파일에 함께 담겨 오는 가중치는 재연할 뿐 감사하지 않습니다.** 가중치를 켠 로또 추첨은 앱이
  추첨 시점에 집계한 번호별 당첨 횟수로 결정되고, 그 집계는 매주 달라지기 때문에 검증 파일 안에 함께
  들어옵니다. 이 페이지는 바로 그 횟수를 그대로 사용해서 추첨을 재연하고 집계 대상 회차 범위를
  함께 보여주지만("가중치 — 번호별 로또 당첨 횟수, N-M 회차 집계"), 그 횟수 자체가 실제 값인지는
  알려주지 못합니다. 그 부분을 확인하려면 공식 로또 자료에서 해당 회차 범위를 찾아 직접 비교해야
  합니다.

- **예비당첨자는 라벨 문자열로 구분합니다.** 결과 파일은 예비당첨자를 앱이 자기 화면 언어로
  기록한 접두사로 표시하며, 그 접두사는 `예비당첨자` 또는 `Backup Winner` 입니다. 다른 방식으로
  표시한 파일은 본당첨 행과 예비당첨 행으로 나누지 못합니다. 이때는 불일치로 보고하지 않고
  판정을 보류합니다. 행 자체는 올바른데 표시만 읽지 못하는 경우일 수 있기 때문입니다. 앱에
  언어를 추가하면 그 언어의 라벨도 이 목록에 추가해야 합니다.

## 저장소 구성

```
index.html  한국어 페이지
en/         영어 페이지
core/       앱에서 이식한 추첨 알고리즘과 난수 생성기 (결과를 결정하는 부분)
pipeline/   재연 파이프라인 — logicVersion(앱 버전에서 로직 버전으로) · v1/(변경하지 않음)
seed/       시드 파생 규칙 (원천 난수값에서 시드로)
parse/      재연한 결과와 검증 파일에 담긴 결과를 대조
bundle/     검증 파일 zip 리더 · 대량 패키지 대조 · 스키마
domain/     추첨 도메인 — 지원 카테고리 목록 · 재연 입력 조립
ui/         화면 층 — 페이지, 워커, 단계 표시, 해시, 리포트
vendor/     고정된 버전의 외부 라이브러리 원본 (rand-seed · js-sha256 · fflate)
msg/ i18n/  메시지 코드와 화면 사전 (한국어 · 영어)
```

## 배포

공개 주소로 게시하는 절차는 이 저장소 밖에서 관리합니다.

## 라이선스

`LICENSE` 를 확인하십시오. 이 소스는 확인 용도로만 공개합니다. 허용되는 행위는 소스 코드를 읽는
것 하나뿐입니다. 소스를 실행하거나 빌드하는 행위, 복제, 수정, 자기 제품이나 서비스에 편입하는
행위, 2차적저작물 작성, 재배포, 그 밖의 상업적·비상업적 이용은 저작권자의 사전 서면 동의 없이 할
수 없습니다. `vendor/` 아래의 제3자 라이브러리에는 각자의 MIT 라이선스가 그대로 적용됩니다.

이 저장소는 공개되어 있지만 패키지 자체는 npm 에 게시하지 않습니다(`private: true`).

---

# UniPicker Draw Replay Verifier

A static page that replays a completed draw inside your browser and checks that the outcome
matches. Drop in the single verification file saved alongside the draw results — no
installation, no sign-in, no configuration, and **no file is ever sent to a server**.

## Getting started

**To verify a draw** — open the public page:
<https://www.unipicker.com/drawing/verifier/en/>
Drag the verification file onto the page and press [Verify].
The Korean edition is at <https://www.unipicker.com/drawing/verifier/>.

The app names the verification file after its own UI language: an English app saves
`draw_verification_2026-09-07-15-30-12.zip`, a Korean one
`추첨검증_2026-09-07-15-30-12.zip`. The verifier never looks at the file name, so a renamed
file can be dropped in as is.

The source in this repository is published for reading only — it is not set up to be run,
built, or tested from a clone, and running a draw replay is done on the public page above.
See [License](#license).

## Rules this verifier follows

1. **No build step, no runtime dependencies.** Third-party libraries are vendored verbatim at
   pinned versions under `vendor/`.
2. **No network calls.** No `fetch`, `XMLHttpRequest`, `WebSocket`, CDN, or remote font. The
   seed source is never re-fetched; the verifier applies the derivation rules to the raw
   randomness value contained in the verification file and compares entirely offline.
3. **`pipeline/v1/` is immutable — from the first public release onward.** Once a version has
   shipped, that folder is left untouched when the app's draw logic changes; a new `pipeline/v2/`
   is added and registered in `LOGIC_VERSIONS` instead. A past draw must keep replaying under the
   logic that was in effect when it ran. (Changes made before the first release do not violate
   this: there is no past draw yet that depends on replaying under the pre-release logic.)
4. **Every value that can change the outcome is compared.** If something cannot be decided, the run
   does not pass: a file that could not be read ends as "unverifiable", and one that was read but
   left nothing to compare is held back as "pending". Neither counts as a match.
5. **Language affects display only.** The URL selects the language (`/verifier/` Korean,
   `/verifier/en/` English). The Korean tokens used to classify uploaded files live as
   literals in `parse/` and `pipeline/`, never in the message dictionaries, so the display
   language cannot change a verdict.

## Limitations

- **Weights that travel in the verification file are replayed, not audited.** A lotto draw with weighting on is decided by
  the per-number win counts the app tallied at draw time, and those counts travel inside the verification file because the
  tally moves every week. This page replays the draw with exactly those counts and shows the round range they
  were tallied over ("Weights — Lotto win counts per number, tallied over rounds N-M"); it cannot tell you
  whether the counts themselves are the real ones. To check that, look the range up at the official lottery
  source and compare by hand.

- **Backup winners are told apart by a label string.** The result file marks a backup winner with a
  prefix the app wrote in its own UI language — `예비당첨자` or `Backup Winner`. A file that labels them
  any other way cannot be split into main and backup rows here. When that happens the run is not reported
  as a mismatch: the verdict is withheld ("pending"), because the rows may well be correct and only their
  marking unreadable. Adding a language to the app means adding its label to this list.

## Repository layout

```
index.html  Korean page
en/         English page
core/       Draw algorithms and RNGs ported from the app (the outcome-determining parts)
pipeline/   Replay pipeline — logicVersion (app version → logic version) · v1/ (immutable)
seed/       Seed derivation rules (raw randomness value → seed)
parse/      Compares the replayed result against the result in the verification file
bundle/     Verification file zip reader · bulk package comparison · schema
domain/     Draw domain — supported category catalogue · replay input assembly
ui/         Presentation layer — page, worker, staging, hashing, report
vendor/     Vendored originals at pinned versions (rand-seed · js-sha256 · fflate)
msg/ i18n/  Message codes and display dictionaries (Korean · English)
```

## Deployment

Publishing to the public URL follows an internal procedure, documented outside this repository.

## License

See `LICENSE` — published for source inspection only. Reading the source code is the sole
permitted use. Executing or building the source, copying, modification, incorporation into
your own product or service, derivative works, redistribution, and any other commercial or
non-commercial use are prohibited without the prior written consent of the copyright holder.
Third-party libraries under `vendor/` remain under their own MIT licenses.

This repository is public, but the package itself is not published to npm (`private: true`).
