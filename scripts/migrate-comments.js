// scripts/migrate-comments.js — migrate data/comments.json (GitHub) -> Supabase comments table
// Chạy: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/migrate-comments.js
// Hoặc: npm run migrate:comments (cần thêm script)
// Yêu cầu: đã chạy supabase.sql để tạo bảng public.comments với RLS
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://pmotbltodyyilarnvtpn.supabase.co').replace(/\/$/,'');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_KEY || '').trim();

if(!SERVICE_KEY){
  console.error('Thiếu SUPABASE_SERVICE_KEY (lấy từ Supabase Dashboard → API Keys → sb_secret...)');
  process.exit(1);
}

async function sbFetch(p, opts){
  const r = await fetch(`${SUPABASE_URL}${p}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers||{})
    }
  });
  const text = await r.text().catch(()=> '');
  let j=null; try{ j=text?JSON.parse(text):null; }catch{}
  return {status:r.status, json:j, text};
}

async function main(){
  const file = path.join(__dirname, '../data/comments.json');
  if(!fs.existsSync(file)){
    console.error('Không tìm thấy', file);
    process.exit(1);
  }
  const raw = fs.readFileSync(file,'utf-8');
  let list;
  try{ list = JSON.parse(raw); }catch(e){ console.error('JSON parse lỗi', e.message); process.exit(1); }
  if(!Array.isArray(list)) list=[];
  console.log(`Tìm thấy ${list.length} comments trong data/comments.json`);
  // Lọc lowQuality nếu có cờ, nhưng giữ nguyên approved/pending
  let batch = [];
  for(const c of list){
    if(!c || !c.id || !c.game) continue;
    // Chuẩn hóa
    const id = String(c.id).slice(0,64);
    const game = String(c.game).slice(0,120);
    const name = String(c.name||'').slice(0,30);
    const stars = Math.min(5, Math.max(0, parseInt(c.stars,10)||0));
    const text = String(c.text||'').slice(0,500);
    const status = (c.status==='approved' || c.status==='pending') ? c.status : 'pending';
    const parent_id = c.parentId ? String(c.parentId).slice(0,64) : (c.parent_id ? String(c.parent_id).slice(0,64) : null);
    const uid = c.uid ? String(c.uid).slice(0,64) : null;
    const created_at = c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString();
    batch.push({id, game, name, stars, text, status, parent_id, uid, created_at});
  }
  console.log(`Chuẩn hóa ${batch.length} bản ghi, ví dụ:`, batch[0]);
  // Upsert theo batch 50
  const CHUNK=50;
  let ok=0, fail=0;
  for(let i=0;i<batch.length;i+=CHUNK){
    const chunk = batch.slice(i,i+CHUNK);
    const r = await sbFetch('/rest/v1/comments?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(chunk)
    });
    if(r.status===200 || r.status===201 || r.status===204){
      ok+=chunk.length;
      console.log(`Upsert ${i+1}-${i+chunk.length} OK (${r.status})`);
    }else{
      fail+=chunk.length;
      console.error(`Upsert ${i+1}-${i+chunk.length} FAIL ${r.status}`, r.text.slice(0,300));
      // Thử từng cái để biết lỗi chi tiết
      for(const row of chunk){
        const rr = await sbFetch('/rest/v1/comments?on_conflict=id', {
          method:'POST', headers:{Prefer:'resolution=merge-duplicates'}, body: JSON.stringify(row)
        });
        if(rr.status===200||rr.status===201||rr.status===204) ok++; else {fail++; console.error('  row',row.id, rr.status, rr.text.slice(0,200));}
      }
    }
  }
  console.log(`\nHoàn tất: ${ok} OK, ${fail} lỗi`);
  if(ok>0){
    // Kiểm tra count
    const cnt = await sbFetch(`/rest/v1/comments?select=id&limit=1`, {headers:{Prefer:'count=exact'}});
    const total = cnt.headers ? cnt.headers['content-range'] : '';
    console.log('Kiểm tra total (header content-range):', total);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
