import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema
} from "./common.js";

export const AuditEventSchema = z.object({
  id: IdSchema,

  actorUserId:
    IdSchema.nullable(),

  actorSnapshot:
    z.record(z.string(), z.unknown()).nullable(),

  action:
    z.string().min(1),

  targetType:
    z.string().min(1),

  targetId:
    IdSchema.nullable(),

  targetSnapshot:
    z.record(z.string(), z.unknown()).nullable(),

  metadata:
    z.record(z.string(), z.unknown()),

  occurredAt:
    IsoDateTimeSchema
}).strict();

export type AuditEvent =
  z.infer<typeof AuditEventSchema>;
