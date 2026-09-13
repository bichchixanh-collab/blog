import fs from 'node:fs';
const s = fs.readFileSync('goc-senpai.html', 'utf-8');
const cnt = (re) => (s.match(re) || []).length;
console.log('div:', cnt(/<div/g), cnt(/<\/div>/g), '| section:', cnt(/<section/g), cnt(/<\/section>/g));
const ids = ['petEmo','petName','petMood','petNote','barNo','barVui','foodN','expN','pityN','spinBox','spunBox','clawTrack','clawBtn','clawWin','advBox','skillRow','powN','eatList','battleBtn','battleOut','statN','badgeRow','themeSel','feedBtn','playBtn','senMsg'];
let miss = 0;
for (const id of ids) if (!s.includes('id="' + id + '"')) { console.log('THIEU ID:', id); miss++; }
console.log(miss ? 'FAIL' : 'IDS-OK');
