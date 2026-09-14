import type {
  AuditEvent
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type AuditRow = {
  id: string;
  actor_user_id: string | null;
  actor_snapshot: Record<string, unknown> | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_snapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  occurred_at: Date;
};

function toAuditEvent(
  row: AuditRow
): AuditEvent {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorSnapshot: row.actor_snapshot,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetSnapshot: row.target_snapshot,
    metadata: row.metadata,
    occurredAt:
      row.occurred_at.toISOString()
  };
}

export async function writeAuditEvent(
  input: {
    actorUserId?: string | null;
    actorSnapshot?: Record<string, unknown> | null;

    action: string;

    targetType: string;
    targetId?: string | null;

    targetSnapshot?: Record<string, unknown> | null;

    metadata?: Record<string, unknown>;
  },
  db: DbExecutor = pool
): Promise<void> {
  await db.query(
    `
      INSERT INTO audit_events (
        actor_user_id,
        actor_snapshot,
        action,
        target_type,
        target_id,
        target_snapshot,
        metadata
      )
      VALUES (
        $1,
        $2::jsonb,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7::jsonb
      )
    `,
    [
      input.actorUserId ?? null,

      input.actorSnapshot
        ? JSON.stringify(
            input.actorSnapshot
          )
        : null,

      input.action,
      input.targetType,
      input.targetId ?? null,

      input.targetSnapshot
        ? JSON.stringify(
            input.targetSnapshot
          )
        : null,

      JSON.stringify(
        input.metadata ?? {}
      )
    ]
  );
}

export async function listAuditEvents(
  limit = 200
): Promise<AuditEvent[]> {
  const safeLimit =
    Math.min(
      Math.max(limit, 1),
      1000
    );

  const result =
    await pool.query<AuditRow>(
      `
        SELECT
          id,
          actor_user_id,
          actor_snapshot,
          action,
          target_type,
          target_id,
          target_snapshot,
          metadata,
          occurred_at

        FROM audit_events

        ORDER BY occurred_at DESC

        LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows.map(
    toAuditEvent
  );
}
