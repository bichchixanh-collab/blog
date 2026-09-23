// scripts/migrate-to-supabase.js
// Chạy 1 lần trên máy local (có localStorage data) để đẩy data cũ lên Supabase
// Cách chạy: node scripts/migrate-to-supabase.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SB_URL = process.env.SUPABASE_URL || 'https://pmotbltodyyilarnvtpn.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || ''; // cần service key
const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// Giả lập localStorage data (đọc từ file backup hoặc nhập tay)
const MOCK_LOCAL_STORAGE = {
  'j2me_xp': '{"xp": 1234}',
  'j2me_favs': '["game1","game2"]',
  'j2me_done': '["game3"]',
  'j2me_seen': '["game1","game4"]',
  'j2me_dl_total': '5',
  'j2me_cmt_total': '2',
  'j2me_cmt_names': '["Sen","Other"]'
};

// Map localStorage key → Supabase table + transform function
const MIGRATION_MAP = [
  {
    key: 'j2me_xp',
    table: 'user_xp',
    transform: (v) => {
      const xp = JSON.parse(v).xp || 0;
      return { xp, level: Math.floor(xp / 100) || 1, total_xp: xp };
    }
  },
  {
    key: 'j2me_favs',
    table: 'user_favorites',
    transform: (v) => {
      const arr = JSON.parse(v);
      return arr.map(game_id => ({ game_id }));
    },
    multi: true
  },
  {
    key: 'j2me_done',
    table: 'user_completed',
    transform: (v) => {
      const arr = JSON.parse(v);
      return arr.map(game_id => ({ game_id }));
    },
    multi: true
  },
  {
    key: 'j2me_seen',
    table: 'user_seen',
    transform: (v) => {
      const arr = JSON.parse(v);
      return arr.map(game_id => ({ game_id }));
    },
    multi: true
  }
];

async function migrate() {
  console.log('🚀 Bắt đầu migration...');

  for (const m of MIGRATION_MAP) {
    try {
      // Đọc localStorage (giả lập - thực tế đọc từ file backup)
      const raw = MOCK_LOCAL_STORAGE[m.key];
      if (!raw) { console.log(`⏭️  Bỏ qua ${m.key}: không có data`); continue; }

      const transformed = m.transform(raw);

      const isStats = m.table === 'user_stats';
      const userKey = isStats ? 'uid' : 'user_id';
      const conflictByTable = {
        user_favorites: 'user_id,game_id',
        user_completed: 'user_id,game_id',
        user_seen: 'user_id,game_id',
      };
      const onConflict = conflictByTable[m.table] || userKey;
      const stamp = () => ({ [userKey]: 'test-user-id', updated_at: new Date().toISOString() });
      if (m.multi) {
        for (const item of transformed) {
          const { error } = await supabase
            .from(m.table)
            .upsert({ ...stamp(), ...item }, { onConflict })
            .select()
            .maybeSingle();
          if (error) console.error(`❌ ${m.table}:`, error.message);
          else console.log(`✅ ${m.table} +1`);
        }
      } else {
        const { error } = await supabase
          .from(m.table)
          .upsert({ ...stamp(), ...transformed }, { onConflict })
          .select()
          .maybeSingle();
        if (error) console.error(`❌ ${m.table}:`, error.message);
        else console.log(`✅ ${m.table} upserted`);
      }
    } catch (e) {
      console.error(`❌ ${m.table}:`, e.message);
    }
  }

  console.log('🎉 Migration hoàn tất!');
  process.exit(0);
}

migrate().catch(e => { console.error('💥 Fatal:', e); process.exit(1); });