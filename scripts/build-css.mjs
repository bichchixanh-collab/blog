// scripts/build-css.mjs — node scripts/build-css.mjs : minify main.css -> main.min.css + in critical vào index.html
// Fix "CSS 36K không minify, không critical".
import fs from 'node:fs';
const src = fs.readFileSync('assets/css/main.css', 'utf-8');
const min = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').trim();
fs.writeFileSync('assets/css/main.min.css', min);
console.log(`main.css ${src.length}B -> main.min.css ${min.length}B`);
// critical: topbar+hero+card đầu, inline <style> trong index.html để FCP nhanh, còn lại load async
const crit = min.slice(0, 3000);
let html = fs.readFileSync('index.html', 'utf-8');
if (!html.includes('/*CRIT*/')) {
  html = html.replace('<link rel="stylesheet" href="assets/css/main.css">',
    `<style>/*CRIT*/${crit}</style><link rel="stylesheet" href="assets/css/main.min.css" media="print" onload="this.media='all'">`);
  fs.writeFileSync('index.html', html);
  console.log('inlined critical CSS');
}
