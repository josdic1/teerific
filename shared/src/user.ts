import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common.js";

export const UserSummarySchema = z.object({
  id: IdSchema,
  displayName: z.string().trim().min(1).max(100)
}).strict();

export const CurrentUserSchema = UserSummarySchema.extend({
  email: z.string().trim().toLowerCase().email(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
}).strict();

export type UserSummary = z.infer<typeof UserSummarySchema>;
export type CurrentUser = z.infer<typeof CurrentUserSchema>;
