// api/pets.js — CRUD user_pets (client dùng Bearer token)
const { getUserId, validateTable, getOne, getAll, upsertOne, insertOne } = require('./supabase-crud');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) { send(res, 401, { error: 'login required' }); return; }

    const table = 'user_pets';

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('user_pets')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      send(res, 200, data || {});
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const { exp, stage, fun, hunger, act } = body || {};
      const { data, error } = await supabase
        .from('user_pets')
        .upsert({ user_id: userId, exp: exp || 0, stage: stage || 0, fun: fun || 100, hunger: hunger || 100, act: act || {}, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      send(res, 200, data);
      return;
    }

    send(res, 405, { error: 'method not allowed' });
  } catch (e) { send(res, 500, { error: e.message }); }
};

function readJsonBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
  }
}

const supabase = require('./supabase-crud');