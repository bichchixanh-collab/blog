// scripts/mincss.mjs — minify CSS + JS (style.css -> style.min.css, manga.css -> manga.min.css, i18n.js -> i18n.min.js, game/index page css)
import fs from 'node:fs';
function minCss(src){
  const before = (src.match(/\{/g) || []).length;
  let s = src.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s*([{}:;,>~+])\s*/g, '$1');
  s = s.replace(/;}/g, '}');
  s = s.trim();
  const after = (s.match(/\{/g) || []).length;
  if(before!==after){ console.error(`RULE MISMATCH ${before} vs ${after}`); process.exit(1); }
  return s;
}
function minJs(src){
  let s = src.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/\/\/.*?\n/g, '\n');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s*([{}:;,=\(\)\[\]<>+\-])\s*/g, '$1');
  return s.trim();
}
let s = fs.readFileSync('style.css', 'utf-8');
let min = minCss(s);
fs.writeFileSync('style.min.css', min);
console.log(`style.css ${s.length} -> style.min.css ${min.length} rules=${(min.match(/\{/g)||[]).length}`);
// manga.css
try{
  let m = fs.readFileSync('assets/css/manga.css','utf-8');
  let mm = minCss(m);
  fs.writeFileSync('assets/css/manga.min.css', mm);
  console.log(`manga.css ${m.length} -> manga.min.css ${mm.length}`);
}catch(e){}
// game/index page css (already extracted, ensure min)
for(const f of ['assets/css/game-page.css','assets/css/index-page.css']){
  try{
    let c = fs.readFileSync(f,'utf-8');
    let cc = minCss(c);
    fs.writeFileSync(f, cc);
    console.log(`${f} min ${c.length} -> ${cc.length}`);
  }catch(e){}
}
// i18n.js
try{
  let j = fs.readFileSync('assets/i18n.js','utf-8');
  let jj = minJs(j);
  fs.writeFileSync('assets/i18n.min.js', jj);
  console.log(`i18n.js ${j.length} -> i18n.min.js ${jj.length}`);
}catch(e){}
