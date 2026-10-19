import pg from 'pg';

pg.types.setTypeParser(20, val => parseInt(val, 10));
pg.types.setTypeParser(1700, val => parseFloat(val));
pg.types.setTypeParser(1082, val => val);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10
});
