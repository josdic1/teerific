import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common.js";

export const SessionSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  expiresAt: IsoDateTimeSchema,
  createdAt: IsoDateTimeSchema
}).strict();

export type Session = z.infer<typeof SessionSchema>;
