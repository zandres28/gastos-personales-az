import 'dotenv/config';
import dns from 'node:dns';
import pg from 'pg';
import { pool } from '../db.js';

const USAGE = `
Uso:
  SUPABASE_DB_URL="postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres?sslmode=require" \\
  DATABASE_URL="postgres://..." \\
  npm run import

Tipos de SUPABASE_DB_URL soportados:
  - Directa:    postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres?sslmode=require
  - Pooler:     postgresql://postgres.<ref>:PASSWORD@aws-0-xxx.pooler.supabase.com:6543/postgres?sslmode=require

Si el TLS local lo intercepta un antivirus/proxy, agregá SUPABASE_SSL_RELAX=1.

El script:
  1. Copia auth.users -> users (conserva hashes bcrypt: las contraseñas siguen sirviendo)
  2. Copia categories, payment_methods y gastos
  3. Asigna a tu usuario los gastos con user_id NULL (equivale a migrate_old_data)
  4. Es idempotente: re-ejecutar no duplica filas (ON CONFLICT DO NOTHING)

Requiere que el schema local ya esté aplicado: npm run migrate
`;

if (!process.env.SUPABASE_DB_URL || !process.env.DATABASE_URL) {
  console.error(USAGE);
  process.exit(1);
}

const srcSsl = process.env.SUPABASE_SSL_RELAX === '1'
  ? { rejectUnauthorized: false }
  : { rejectUnauthorized: true };

function windowsFriendlyLookup(hostname, options, callback) {
  const finish = (err, records) => {
    if (err) return callback(err);
    const list = (Array.isArray(records) ? records : [records])
      .map(r => typeof r === 'string' ? r : (r.address ?? r.value))
      .filter(a => typeof a === 'string' && (a.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(a)))
      .map(address => ({ address, family: address.includes(':') ? 6 : 4 }));
    if (!list.length) {
      const e = new Error(`ENOTFOUND ${hostname}`);
      e.code = 'ENOTFOUND';
      return callback(e);
    }
    if (options.all) return callback(null, list);
    const chosen = options.family === 4
      ? (list.find(a => a.family === 4) || list[0])
      : (list.find(a => a.family === 6) || list[0]);
    callback(null, chosen.address, chosen.family);
  };
  dns.resolveAny(hostname, finish);
}

const src = new pg.Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  max: 2,
  ssl: srcSsl,
  lookup: windowsFriendlyLookup
});
const looksBcrypt = h => typeof h === 'string' && /^\$2[aby]\$/.test(h);

async function copyUsers() {
  const { rows } = await src.query(
    `SELECT id, email, encrypted_password, created_at
     FROM auth.users
     WHERE email IS NOT NULL AND encrypted_password IS NOT NULL
     ORDER BY created_at ASC`
  );
  if (!rows.length) {
    throw new Error('No se encontraron usuarios en auth.users. ¿La SUPABASE_DB_URL apunta al proyecto correcto?');
  }
  let ok = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!looksBcrypt(row.encrypted_password)) {
      console.warn(`AVISO: hash no-bcrypt para ${row.email}, se omite el usuario`);
      skipped++;
      continue;
    }
    const res = await pool.query(
      `INSERT INTO users (id, email, password_hash, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.email.toLowerCase(), row.encrypted_password, row.created_at]
    );
    ok += res.rowCount;
  }
  console.log(`Usuarios: ${ok} copiados, ${skipped} omitidos, ${rows.length - ok - skipped} ya existentes`);
  return ok + skipped > 0;
}

async function firstUserId() {
  const { rows } = await pool.query('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
  return rows[0]?.id ?? null;
}

async function copyTable(table, { assignOrphans = false } = {}) {
  const { rows } = await src.query(`SELECT * FROM ${table}`);
  if (!rows.length) {
    console.log(`${table}: 0 filas en origen`);
    return;
  }
  const fallbackUser = assignOrphans ? await firstUserId() : null;
  const allCols = Object.keys(rows[0]);
  let ok = 0;
  let orphanAssigned = 0;
  for (const row of rows) {
    let userId = row.user_id;
    if (assignOrphans && (userId == null)) {
      userId = fallbackUser;
      orphanAssigned++;
    }
    if (assignOrphans && userId != null) {
      const check = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
      if (!check.rowCount) {
        if (!fallbackUser) throw new Error(`${table}: user_id ${userId} no existe en users local`);
        userId = fallbackUser;
        orphanAssigned++;
      }
    }
    const values = allCols.map(c => (c === 'user_id' ? userId : row[c]));
    const placeholders = allCols.map((_, i) => `$${i + 1}`);
    const res = await pool.query(
      `INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders.join(', ')})
       ON CONFLICT (id) DO NOTHING`,
      values
    );
    ok += res.rowCount;
  }
  console.log(`${table}: ${ok} insertadas, ${rows.length - ok} ya existentes${assignOrphans ? `, ${orphanAssigned} huérfanas asignadas a tu usuario` : ''}`);
}

try {
  const hasUsers = await copyUsers();
  if (!hasUsers) throw new Error('No hay usuarios que importar');
  await copyTable('categories');
  await copyTable('payment_methods');
  await copyTable('gastos', { assignOrphans: true });
  console.log('Importación completada');
} catch (err) {
  console.error('Error en la importación:', err.message);
  process.exitCode = 1;
} finally {
  await src.end();
  await pool.end();
}
