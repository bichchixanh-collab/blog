// api/_github.js — GitHub write bị giới hạn đúng 2 file, cảnh báo token scope rộng.
// Dùng Fine-grained PAT: Contents RW chỉ cho data/stats.json + data/comments.json.
const https = require('https');
const ALLOW = new Set(['data/stats.json', 'data/comments.json']);
function gh(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request({ hostname: 'api.github.com', path: apiPath, method,
      headers: { 'User-Agent': 'j2me-v2', Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}) } },
      (res) => { let raw = ''; res.on('data', (c) => (raw += c)); res.on('end', () => resolve({ code: res.statusCode, body: raw })); });
    req.on('error', reject);
    req.setTimeout(7000, () => { try { req.destroy(new Error('github timeout')); } catch (e) {} });
    if (payload) req.write(payload);
    req.end();
  });
}
async function writeFile({ file, json, message }) {
  if (!ALLOW.has(file)) throw new Error('file not allowed: ' + file);
  const token = process.env.GITHUB_TOKEN || '';
  if (!token) throw new Error('missing GITHUB_TOKEN');
  if (token.startsWith('ghp_')) console.warn('[sec] classic PAT detected — hãy đổi sang fine-grained chỉ RW data/*.json');
  const repo = process.env.GITHUB_REPO || 'bichchixanh-collab/blog';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const r = await gh('GET', `/repos/${repo}/contents/${file}?ref=${branch}`, token);
  let sha = null;
  if (r.code === 200) sha = JSON.parse(r.body).sha;
  const content = Buffer.from(JSON.stringify(json)).toString('base64');
  const put = await gh('PUT', `/repos/${repo}/contents/${file}`, token, { message, content, branch, ...(sha ? { sha } : {}) });
  if (put.code !== 200 && put.code !== 201) throw new Error('github write ' + put.code);
  return JSON.parse(put.body).content.sha;
}
module.exports = { writeFile, ALLOWED_FILES: [...ALLOW] };
