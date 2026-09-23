import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(?:js|mjs)$/.test(name.name)) out.push(p);
  }
  return out;
}
const files = walk('.').filter((p) => !p.includes(`${path.sep}node_modules${path.sep}`));
let bad = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) { bad++; console.error(`BAD syntax: ${file}\n${r.stderr || r.stdout}`); }
}
console.log(bad ? `FAIL: ${bad} syntax error(s)` : `OK: ${files.length} JS/MJS files syntax-clean`);
process.exit(bad ? 1 : 0);
