import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema
} from "./common.js";
import {
  PhoneNumberSchema
} from "./user.js";

export const AdminUserIdentitySchema = z.object({
  id: IdSchema,
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .nullable(),
  phoneNumber: PhoneNumberSchema,
  isAdmin: z.boolean()
}).strict();

export const AdminOwnedClubhouseSchema = z.object({
  id: IdSchema,
  name: z.string(),
  deactivatedAt:
    IsoDateTimeSchema.nullable()
}).strict();

export const AdminMembershipSchema = z.object({
  id: IdSchema,

  clubhouse: z.object({
    id: IdSchema,
    name: z.string(),

    primary: AdminUserIdentitySchema
  }).strict(),

  joinedAt: IsoDateTimeSchema,

  deactivatedAt:
    IsoDateTimeSchema.nullable()
}).strict();

export const AdminUserSchema = z.object({
  id: IdSchema,

  displayName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .nullable(),

  phoneNumber: PhoneNumberSchema,

  phoneVerifiedAt:
    IsoDateTimeSchema,

  isAdmin: z.boolean(),

  createdAt:
    IsoDateTimeSchema,

  updatedAt:
    IsoDateTimeSchema,

  roundCount:
    z.number().int().nonnegative(),

  lastActivityAt:
    IsoDateTimeSchema.nullable(),

  ownedClubhouses:
    z.array(AdminOwnedClubhouseSchema),

  memberships:
    z.array(AdminMembershipSchema)
}).strict();

export const AdminClubhouseMemberSchema =
  z.object({
    id: IdSchema,

    user:
      AdminUserIdentitySchema,

    joinedAt:
      IsoDateTimeSchema,

    deactivatedAt:
      IsoDateTimeSchema.nullable()
  }).strict();

export const AdminClubhouseSchema = z.object({
  id: IdSchema,
  name: z.string(),

  primary:
    AdminUserIdentitySchema,

  deactivatedAt:
    IsoDateTimeSchema.nullable(),

  createdAt:
    IsoDateTimeSchema,

  updatedAt:
    IsoDateTimeSchema,

  members:
    z.array(
      AdminClubhouseMemberSchema
    )
}).strict();

export type AdminUserIdentity =
  z.infer<typeof AdminUserIdentitySchema>;

export type AdminOwnedClubhouse =
  z.infer<typeof AdminOwnedClubhouseSchema>;

export type AdminMembership =
  z.infer<typeof AdminMembershipSchema>;

export type AdminUser =
  z.infer<typeof AdminUserSchema>;

export type AdminClubhouseMember =
  z.infer<typeof AdminClubhouseMemberSchema>;

export type AdminClubhouse =
  z.infer<typeof AdminClubhouseSchema>;
