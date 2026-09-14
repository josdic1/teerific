import type {
  PoolClient,
  QueryResult,
  QueryResultRow
} from "pg";
import { pool } from "./pool.js";

export interface DbExecutor {
  query<R extends QueryResultRow = any>(
    text: string,
    values?: any[]
  ): Promise<QueryResult<R>>;
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await work(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
