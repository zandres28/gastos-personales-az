import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../auth.js';
import { wrap, UUID_RE } from '../util.js';

export const gastosRoutes = Router();
gastosRoutes.use(authRequired);

const COLS = 'id, amount, category, note, date, timestamp, payment_method, user_id, created_at';

function validateGasto(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Monto inválido' };
    out.amount = Math.round(amount * 100) / 100;
  }
  if (!partial || body.category !== undefined) {
    const category = String(body.category ?? '').trim();
    if (!category) return { error: 'Categoría requerida' };
    out.category = category;
  }
  if (body.note !== undefined) out.note = String(body.note ?? '').slice(0, 2000);
  if (!partial || body.date !== undefined) {
    const date = String(body.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Fecha inválida' };
    out.date = date;
  }
  if (!partial || body.timestamp !== undefined) {
    const timestamp = Number(body.timestamp);
    if (!Number.isFinite(timestamp)) return { error: 'Timestamp inválido' };
    out.timestamp = Math.trunc(timestamp);
  }
  if (!partial || body.payment_method !== undefined) {
    out.payment_method = String(body.payment_method ?? '').trim() || 'Efectivo';
  }
  return { out };
}

gastosRoutes.get('/', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM gastos WHERE user_id = $1 ORDER BY timestamp DESC`,
    [req.userId]
  );
  res.json(rows);
}));

gastosRoutes.post('/', wrap(async (req, res) => {
  const { out, error } = validateGasto(req.body ?? {});
  if (error) return res.status(400).json({ error });
  const { rows } = await pool.query(
    `INSERT INTO gastos (amount, category, note, date, timestamp, payment_method, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLS}`,
    [out.amount, out.category, out.note ?? '', out.date, out.timestamp, out.payment_method ?? 'Efectivo', req.userId]
  );
  res.status(201).json(rows[0]);
}));

gastosRoutes.patch('/:id', wrap(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
  const { out, error } = validateGasto(req.body ?? {}, { partial: true });
  if (error) return res.status(400).json({ error });
  const sets = [];
  const vals = [];
  for (const key of ['amount', 'category', 'note', 'date', 'timestamp', 'payment_method']) {
    if (out[key] !== undefined) {
      vals.push(out[key]);
      sets.push(`${key} = $${vals.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
  vals.push(req.params.id, req.userId);
  const { rows } = await pool.query(
    `UPDATE gastos SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND user_id = $${vals.length} RETURNING ${COLS}`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
  res.json(rows[0]);
}));

gastosRoutes.delete('/:id', wrap(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
  const { rowCount } = await pool.query(
    'DELETE FROM gastos WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  if (!rowCount) return res.status(404).json({ error: 'No encontrado' });
  res.status(204).end();
}));
