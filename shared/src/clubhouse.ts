import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema
} from "./common.js";
import {
  PhoneNumberSchema,
  UserSummarySchema
} from "./user.js";

export const ClubhouseMemberSchema = z.object({
  id: IdSchema,
  user: UserSummarySchema,
  joinedAt: IsoDateTimeSchema,
  deactivatedAt:
    IsoDateTimeSchema.nullable()
}).strict();

export const ClubhouseSchema = z.object({
  id: IdSchema,

  name: z
    .string()
    .trim()
    .min(1)
    .max(100),

  primary: UserSummarySchema,

  deactivatedAt:
    IsoDateTimeSchema.nullable(),

  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,

  members: z.array(
    ClubhouseMemberSchema
  )
}).strict();

export const CreateClubhouseInputSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(100)
  }).strict();

export const AddClubhouseMemberInputSchema =
  z.object({
    phoneNumber: PhoneNumberSchema
  }).strict();

export type ClubhouseMember =
  z.infer<typeof ClubhouseMemberSchema>;

export type Clubhouse =
  z.infer<typeof ClubhouseSchema>;

export type CreateClubhouseInput =
  z.infer<typeof CreateClubhouseInputSchema>;

export type AddClubhouseMemberInput =
  z.infer<typeof AddClubhouseMemberInputSchema>;
