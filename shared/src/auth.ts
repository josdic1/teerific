import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema
} from "./common.js";
import {
  CurrentUserSchema,
  PhoneNumberSchema
} from "./user.js";

export const RequestPhonePinInputSchema = z.object({
  phoneNumber: PhoneNumberSchema
}).strict();

export const RequestPhonePinResponseSchema = z.object({
  challengeId: IdSchema,
  expiresAt: IsoDateTimeSchema
}).strict();

export const VerifyPhonePinInputSchema = z.object({
  challengeId: IdSchema,
  code: z.string().regex(/^\d{6}$/)
}).strict();

export const AuthResponseSchema = z.object({
  user: CurrentUserSchema
}).strict();

export type RequestPhonePinInput =
  z.infer<typeof RequestPhonePinInputSchema>;

export type RequestPhonePinResponse =
  z.infer<typeof RequestPhonePinResponseSchema>;

export type VerifyPhonePinInput =
  z.infer<typeof VerifyPhonePinInputSchema>;

export type AuthResponse =
  z.infer<typeof AuthResponseSchema>;
