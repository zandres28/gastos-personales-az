import pg from 'pg';

pg.types.setTypeParser(20, val => parseInt(val, 10));
pg.types.setTypeParser(1700, val => parseFloat(val));
pg.types.setTypeParser(1082, val => val);

// En serverless (Vercel) cada instancia mantiene su propio pool: conviene 1
// conexión por instancia para no agotar el pooler de la base.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? (process.env.VERCEL ? 1 : 10))
});
