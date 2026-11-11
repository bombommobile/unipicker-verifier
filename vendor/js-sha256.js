// js-sha256(0.11.1) UMD를 브라우저/노드 공통 ESM으로 노출 — 원본은 전역(globalThis)에 sha256을 심는다.
// ⚠ 노드(ESM)에선 원본이 require('crypto')를 타서 깨지므로, 브라우저와 같은 순수 JS 경로로 강제한다(같은 표준 SHA-256).
const g = globalThis;
const noWindow = typeof window === 'undefined';
if (noWindow) {
  g.window = g; // 원본이 전역에 export 를 심도록 브라우저처럼 인식시킴
  g.JS_SHA256_NO_NODE_JS = true; // node crypto 대신 순수 JS 경로(브라우저와 동일한 해시)
}
await import('./js-sha256.umd.js');
if (noWindow) {
  delete g.window;
  delete g.JS_SHA256_NO_NODE_JS;
}

export const sha256 = g.sha256;
