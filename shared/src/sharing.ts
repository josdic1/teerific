import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common.js";

export const PartnerLinkSchema = z.object({
  id: IdSchema,
  requesterUserId: IdSchema,
  recipientUserId: IdSchema,
  acceptedAt: IsoDateTimeSchema.nullable(),
  revokedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema
}).strict();

export const RoundShareSchema = z.object({
  id: IdSchema,
  roundId: IdSchema,
  viewerUserId: IdSchema,
  grantedAt: IsoDateTimeSchema,
  revokedAt: IsoDateTimeSchema.nullable()
}).strict();

export type PartnerLink = z.infer<typeof PartnerLinkSchema>;
export type RoundShare = z.infer<typeof RoundShareSchema>;
