import { z } from "zod";

export const IdSchema = z.string().uuid();

export const IsoDateTimeSchema = z.string().datetime({
  offset: true
});

export type Id = z.infer<typeof IdSchema>;
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;
