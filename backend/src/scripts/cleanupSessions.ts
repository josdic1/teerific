import { pool } from "../db/pool.js";

try {
  const result = await pool.query(`
    DELETE FROM sessions
    WHERE expires_at <= now()
       OR revoked_at IS NOT NULL
  `);

  console.log(`Deleted ${result.rowCount ?? 0} stale session(s).`);
} finally {
  await pool.end();
}
