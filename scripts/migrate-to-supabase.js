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
  'j2me_senpai': '{"pet":{"exp":134,"stage":0,"fun":100,"hunger":100,"born":1789483490309,"stage":0,"hunger":100,"lastTick":1789484598082,"act":{"feed":3,"play":2,"spin":1}},"gacha":{"pity":1,"theme":"hong","badges":[],"lastSpin":"2026-09-15","themeUnlock":["hong"]},"stats":{"wins":6,"spins":1,"battles":104},"skills":["✨","🌾","🗺️"],"themeUnlock":["hong"]}',
  'j2me_favs': '["game1","game2"]',
  'j2me_done': '["game3"]',
  'j2me_seen': '["game1","game4"]',
  'j2me_bingo_prog': '{"2026-W37":{"feed":1,"play":1}}',
  'j2me_bingo_claim': '{"2026-W37":[0,2]}',
  'j2me_dl_total': '5',
  'j2me_cmt_total': '2',
  'j2me_seen': '["game1","game2"]',
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
    key: 'j2me_senpai',
    table: 'user_pets',
    transform: (v) => {
      const s = JSON.parse(v);
      const pet = s.pet || {};
      const gacha = s.gacha || {};
      const stats = s.stats || {};
      const skills = s.skills || [];
      const themeUnlock = s.themeUnlock || [];
      return {
        exp: pet.exp || 0,
        stage: pet.stage || 0,
        fun: pet.fun || 100,
        hunger: pet.hunger || 100,
        born_at: pet.born ? new Date(pet.born).toISOString() : new Date().toISOString(),
        last_tick_at: pet.lastTick ? new Date(pet.lastTick).toISOString() : new Date().toISOString(),
        act: pet.act || { feed:0,play:0,spin:0,adv:0,win:0,fav:0,share:0,comment:0,mail:0,battle:0,theme:0 }
      };
    }
  },
  {
    key: 'j2me_senpai',
    table: 'user_gacha',
    transform: (v) => {
      const s = JSON.parse(v);
      const g = s.gacha || {};
      return {
        pity: g.pity || 0,
        theme: g.theme || 'hong',
        badges: g.badges || [],
        theme_unlock: g.themeUnlock || ['hong'],
        last_spin_date: g.lastSpin || null
      };
    }
  },
  {
    key: 'j2me_senpai',
    table: 'user_stats',
    transform: (v) => {
      const s = JSON.parse(v);
      const stats = s.stats || {};
      return {
        wins: stats.wins || 0,
        spins: stats.spins || 0,
        battles: stats.battles || 0
      };
    }
  },
  {
    key: 'j2me_senpai',
    table: 'user_pet_skills',
    transform: (v) => {
      const s = JSON.parse(v);
      const skills = s.skills || [];
      return skills.map(skill => ({ skill: skill }));
    },
    multi: true
  },
  {
    key: 'j2me_senpai',
    table: 'user_theme_unlocks',
    transform: (v) => {
      const s = JSON.parse(v);
      const unlock = s.themeUnlock || ['hong'];
      return unlock.map(theme => ({ theme }));
    },
    multi: true
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
  },
  {
    key: 'j2me_bingo_prog',
    table: 'user_bingo',
    transform: (v) => {
      const prog = JSON.parse(v);
      const weekKey = Object.keys(prog)[0] || new Date().toISOString().slice(0, 10);
      return {
        week_key: weekKey,
        cells_done: prog[weekKey] || {},
        claimed: []
      };
    }
  },
  {
    key: 'j2me_bingo_claim',
    table: 'user_bingo',
    transform: (v) => {
      const claims = JSON.parse(v);
      return Object.entries(claims).map(([week, lines]) => ({
        week_key: week,
        cells_done: {},
        claimed: lines
      }));
    },
    multi: true
  }
];

async function migrate() {
  const supabase = require('@supabase/supabase-js').createClient(
    process.env.SUPABASE_URL || 'https://pmotbltodyyilarnvtpn.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || '',
    { auth: { persistSession: false } }
  );

  console.log('🚀 Bắt đầu migration...');

  for (const m of MIGRATION_MAP) {
    try {
      // Đọc localStorage (giả lập - thực tế đọc từ file backup)
      const raw = MOCK_LOCAL_STORAGE[m.key];
      if (!raw) { console.log(`⏭️  Bỏ qua ${m.key}: không có data`); continue; }

      const parsed = JSON.parse(raw);
      const transformed = m.transform(parsed);

      if (m.multi) {
        // Insert nhiều rows
        for (const item of transformed) {
          const { error } = await supabase
            .from(m.table)
            .upsert({ user_id: 'test-user-id', ...item, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
            .single();
          if (err) console.error(`❌ ${m.table}:`, err);
          else console.log(`✅ ${m.table} +1`);
        }
      } else {
        const { error } = await supabase
          .from(m.table)
          .upsert({ user_id: 'test-user-id', ...transformed, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          .single();
        if (err) console.error(`❌ ${m.table}:`, err);
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