import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

const USAGE = `
Exporta tus datos desde la API REST de Supabase (misma que usaba la app) hacia la BD local.

Requiere:
  SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_ANON_KEY=sb_publishable_...   (la publishable key del front)
  SUPABASE_EMAIL=tu@email.com
  SUPABASE_PASSWORD=tu contrasena de la app

La contrasena se usa para:
  1. Autenticarte contra Supabase (GoTrue) y leer solo TUS datos (RLS)
  2. Crear/actualizar tu usuario local con el MISMO hash bcrypt (mismas credenciales)

Es idempotente: re-ejecutar no duplica filas.
`;

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_EMAIL,
  SUPABASE_PASSWORD
} = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_EMAIL || !SUPABASE_PASSWORD) {
  console.error(USAGE);
  process.exit(1);
}

const base = SUPABASE_URL.replace(/\/$/, '');

async function sb(path, options = {}) {
  const res = await fetch(base + path, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Supabase ${path}: ${res.status} ${body?.message || body?.error_description || body?.error || res.statusText}`);
  }
  return body;
}

async function login() {
  const data = await sb('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: SUPABASE_EMAIL.trim().toLowerCase(), password: SUPABASE_PASSWORD })
  });
  return { token: data.access_token, sbUser: data.user };
}

async function fetchAll(token, table) {
  const rows = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const batch = await sb(`/rest/v1/${table}?select=*&order=created_at.asc&limit=${limit}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return rows;
}

async function ensureLocalUser(sbUser, password) {
  const email = sbUser.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await pool.query('SELECT id FROM users WHERE id = $1 OR email = $2', [sbUser.id, email]);
  if (existing.rows[0]) {
    const id = existing.rows[0].id;
    await pool.query('UPDATE users SET email = $2, password_hash = $3 WHERE id = $1', [id, email, passwordHash]);
    return id;
  }
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
    [sbUser.id, email, passwordHash, sbUser.created_at || new Date()]
  );
  return rows[0].id;
}

async function insertRows(table, rows, userId) {
  if (!rows.length) {
    console.log(`${table}: 0 filas`);
    return 0;
  }
  const cols = Object.keys(rows[0]).filter(c => c !== 'user_id');
  const allCols = [...cols, 'user_id'];
  let ok = 0;
  for (const row of rows) {
    const values = allCols.map(c => (c === 'user_id' ? userId : row[c]));
    const placeholders = allCols.map((_, i) => `$${i + 1}`);
    try {
      const res = await pool.query(
        `INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders.join(', ')})
         ON CONFLICT (id) DO NOTHING`,
        values
      );
      ok += res.rowCount;
    } catch (err) {
      console.warn(`${table}: fila ${row.id} omitida (${err.message.slice(0, 80)})`);
    }
  }
  console.log(`${table}: ${ok} insertadas, ${rows.length - ok} ya existentes/omitidas`);
  return ok;
}

console.log('Autenticando contra Supabase...');
const { token, sbUser } = await login();
console.log(`Autenticado como ${sbUser.email} (${sbUser.id})`);

const userId = await ensureLocalUser(sbUser, SUPABASE_PASSWORD);
console.log(`Usuario local: ${userId}`);

const [categories, payments, gastos] = await Promise.all([
  fetchAll(token, 'categories'),
  fetchAll(token, 'payment_methods'),
  fetchAll(token, 'gastos')
]);
console.log(`Descargado: ${categories.length} categorías, ${payments.length} medios de pago, ${gastos.length} gastos`);

await insertRows('categories', categories, userId);
await insertRows('payment_methods', payments, userId);
await insertRows('gastos', gastos, userId);

console.log('Importación completada. Entrá con tu email y contraseña habituales.');
await pool.end();
