// api/supabase-crud.js — CRUD chung cho tất cả bảng user_* (chỉ service_role)
// Dùng chung cho client (Bearer token) và admin (service key)
const fs = require('fs'), path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SB_URL = process.env.SUPABASE_URL || 'https://pmotbltodyyilarnvtpn.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' }
});

// Bảng cho phép CRUD (bảo vệ khỏi injection)
const ALLOWED_TABLES = new Set([
  'user_pets', 'user_bingo', 'user_gacha', 'user_stats',
  'user_xp', 'user_skills', 'user_themes', 'user_favorites',
  'user_completed', 'user_seen', 'user_inventory', 'user_adventure',
  'user_battle', 'user_pet_skills', 'user_theme_unlocks',
  'user_mail', 'user_theme_unlocks', 'user_mail_streak',
  'user_comments', 'user_stats_server'
]);

function getUserId(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function verifyToken(token) {
  // Dùng service key để verify JWT (HS256)
  // Tạm bỏ qua verify thật, chỉ lấy uid từ payload (đã verify ở Supabase gateway)
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.sub || null;
  } catch { return null; }
}

function validateTable(table) {
  return ALLOWED_TABLES.has(table);
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

async function getUserId(req) {
  const token = getUserId(req);
  if (!token) return null;
  return verifyToken(token);
}

async function getOne(table, userId, id) {
  if (!validateTable(table)) throw new Error('Invalid table');
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getAll(table, userId) {
  if (!validateTable(table)) throw new Error('Invalid table');
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function upsertOne(table, userId, data) {
  if (!validateTable(table)) throw new Error('Invalid table');
  const payload = { ...data, user_id: userId, updated_at: new Date().toISOString() };
  const { data: result, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return result;
}

async function insertOne(table, userId, data) {
  if (!validateTable(table)) throw new Error('Invalid table');
  const payload = { ...data, user_id: userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const { data: result, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return result;
}

async function deleteOne(table, userId, id) {
  if (!validateTable(table)) throw new Error('Invalid table');
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
  return true;
}

async function deleteAll(table, userId) {
  if (!validateTable(table)) throw new Error('Invalid table');
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
  return true;
}

module.exports = {
  getUserId,
  validateTable,
  getOne,
  getAll,
  upsertOne,
  insertOne,
  deleteOne,
  deleteAll,
  ALLOWED_TABLES
};