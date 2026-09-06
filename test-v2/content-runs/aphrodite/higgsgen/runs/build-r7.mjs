// runs/build-r7.mjs — template-r7.src.html → render-r7.html
// 30초 연속 비행(5구간, 이음매 프레임 동일)을 base64 로 인라인한다. 렌더 시 외부 요청 0.
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = '/Users/kwakseongjae/Desktop/projects/oh-my-design/';
const RUN = ROOT + 'test-v2/content-runs/aphrodite/higgsgen/';
const font = n => readFileSync(RUN + 'fonts/' + n + '.css', 'utf8').replace(/\/\*[\s\S]*?\*\//, '').trim();
const b64 = (p, mime) => 'data:' + mime + ';base64,' + readFileSync(p).toString('base64');

let s = readFileSync(RUN + 'runs/template-r7.src.html', 'utf8');
s = s.split('{{FONT_SYNE}}').join(font('syne'))
     .split('{{FONT_GEIST}}').join(font('geist'))
     .split('{{FONT_MONO}}').join(font('geist-mono'))
     .split('{{BASE}}').join(readFileSync(RUN + 'folds/src/_base.css', 'utf8'))
     .split('{{VIDEO}}').join(b64(RUN + 'video/flight-720.mp4', 'video/mp4'))
     .split('{{POSTER}}').join(b64(RUN + 'video/poster.jpg', 'image/jpeg'));
writeFileSync(RUN + 'render-r7.html', s);
console.log(`render-r7.html  ${(Buffer.byteLength(s) / 1048576).toFixed(2)}MB`);
