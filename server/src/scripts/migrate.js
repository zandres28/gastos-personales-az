import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schema.sql');
const sql = readFileSync(schemaPath, 'utf8');
await pool.query(sql);
console.log('Schema aplicado correctamente');
await pool.end();
