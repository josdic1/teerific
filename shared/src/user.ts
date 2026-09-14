import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema
} from "./common.js";

export const PhoneNumberSchema = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Phone number must use E.164 format"
  );

export const UserSummarySchema = z.object({
  id: IdSchema,
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .nullable()
}).strict();

export const CurrentUserSchema =
  UserSummarySchema.extend({
    phoneNumber: PhoneNumberSchema,
    phoneVerifiedAt: IsoDateTimeSchema,
    isAdmin: z.boolean(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema
  }).strict();

export const UpdateAccountInputSchema =
  z.object({
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(100)
  }).strict();

export type UserSummary =
  z.infer<typeof UserSummarySchema>;

export type CurrentUser =
  z.infer<typeof CurrentUserSchema>;

export type UpdateAccountInput =
  z.infer<typeof UpdateAccountInputSchema>;
