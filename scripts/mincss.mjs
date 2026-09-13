// scripts/mincss.mjs — node scripts/mincss.mjs : style.css -> style.min.css (chỉ whitespace/comments)
import fs from 'node:fs';
let s = fs.readFileSync('style.css', 'utf-8');
const rulesBefore = (s.match(/\{/g) || []).length;
s = s.replace(/\/\*[\s\S]*?\*\//g, '');
s = s.replace(/\s+/g, ' ');
s = s.replace(/\s*([{}:;,>~+])\s*/g, '$1');
s = s.replace(/;}/g, '}');
s = s.trim();
const rulesAfter = (s.match(/\{/g) || []).length;
if (rulesBefore !== rulesAfter) { console.error(`RULE MISMATCH ${rulesBefore} vs ${rulesAfter} — không ghi file`); process.exit(1); }
fs.writeFileSync('style.min.css', s);
console.log(`OK rules=${rulesAfter} bytes=${s.length}`);
