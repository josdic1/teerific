import type {
  CurrentUser
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";
import {
  writeAuditEvent
} from "../repositories/auditRepository.js";

export function userSnapshot(
  user: CurrentUser
): Record<string, unknown> {
  return {
    id: user.id,
    displayName: user.displayName,
    phoneNumber: user.phoneNumber,
    isAdmin: user.isAdmin
  };
}

export async function audit(
  input: {
    actor?: CurrentUser | null;

    action: string;

    targetType: string;
    targetId?: string | null;

    targetSnapshot?: Record<string, unknown> | null;

    metadata?: Record<string, unknown>;
  },
  db: DbExecutor = pool
): Promise<void> {
  await writeAuditEvent(
    {
      actorUserId:
        input.actor?.id ?? null,

      actorSnapshot:
        input.actor
          ? userSnapshot(input.actor)
          : null,

      action:
        input.action,

      targetType:
        input.targetType,

      targetId:
        input.targetId ?? null,

      targetSnapshot:
        input.targetSnapshot ?? null,

      metadata:
        input.metadata ?? {}
    },
    db
  );
}
