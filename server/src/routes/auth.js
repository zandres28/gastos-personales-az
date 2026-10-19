import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { setAuthCookie, clearAuthCookie, authRequired } from '../auth.js';
import { wrap } from '../util.js';

export const authRoutes = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_COLS = 'id, email, created_at';

authRoutes.post('/register', wrap(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Email inválido' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (existing.rowCount) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING ${USER_COLS}`,
    [email, passwordHash]
  );
  const user = rows[0];
  setAuthCookie(res, user);
  res.status(201).json({ user });
}));

authRoutes.post('/login', wrap(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const { rows } = await pool.query('SELECT id, email, password_hash, created_at FROM users WHERE email = $1', [email]);
  const row = rows[0];
  const ok = row && (await bcrypt.compare(password, row.password_hash));
  if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  const user = { id: row.id, email: row.email, created_at: row.created_at };
  setAuthCookie(res, user);
  res.json({ user });
}));

authRoutes.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRoutes.get('/me', authRequired, wrap(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: 'No autenticado' });
  res.json({ user: rows[0] });
}));
