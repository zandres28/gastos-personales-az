import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../auth.js';
import { wrap, UUID_RE } from '../util.js';

export const categoriesRoutes = Router();
categoriesRoutes.use(authRequired);

const COLS = 'id, name, icon, color, user_id, created_at';

categoriesRoutes.get('/', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM categories WHERE user_id = $1 ORDER BY created_at ASC`,
    [req.userId]
  );
  res.json(rows);
}));

categoriesRoutes.post('/', wrap(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  if (name.length > 100) return res.status(400).json({ error: 'Nombre demasiado largo' });
  const icon = String(req.body?.icon ?? '📁');
  const color = String(req.body?.color ?? '#7A7168');
  const { rows } = await pool.query(
    `INSERT INTO categories (name, icon, color, user_id) VALUES ($1, $2, $3, $4) RETURNING ${COLS}`,
    [name, icon, color, req.userId]
  );
  res.status(201).json(rows[0]);
}));

categoriesRoutes.patch('/:id', wrap(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'No encontrada' });
  const sets = [];
  const vals = [];
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    vals.push(name);
    sets.push(`name = $${vals.length}`);
  }
  if (req.body?.icon !== undefined) {
    vals.push(String(req.body.icon));
    sets.push(`icon = $${vals.length}`);
  }
  if (req.body?.color !== undefined) {
    vals.push(String(req.body.color));
    sets.push(`color = $${vals.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
  vals.push(req.params.id, req.userId);
  const { rows } = await pool.query(
    `UPDATE categories SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND user_id = $${vals.length} RETURNING ${COLS}`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'No encontrada' });
  res.json(rows[0]);
}));

categoriesRoutes.delete('/:id', wrap(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'No encontrada' });
  const { rowCount } = await pool.query(
    'DELETE FROM categories WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  if (!rowCount) return res.status(404).json({ error: 'No encontrada' });
  res.status(204).end();
}));
