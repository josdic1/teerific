import "dotenv/config";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to use PostgreSQL");
}

export const pool = new Pool({
  connectionString: databaseUrl
});
