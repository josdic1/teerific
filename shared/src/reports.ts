import { z } from "zod";

export const AdminGolfSummarySchema = z.object({
  totalUsers:
    z.number().int().nonnegative(),

  totalClubhouses:
    z.number().int().nonnegative(),

  totalRounds:
    z.number().int().nonnegative(),

  completedRounds:
    z.number().int().nonnegative(),

  abandonedRounds:
    z.number().int().nonnegative(),

  averageRoundMinutes:
    z.number().nonnegative().nullable(),

  averageHoleMinutes:
    z.number().nonnegative().nullable(),

  totalLocationSamples:
    z.number().int().nonnegative()
}).strict();

export type AdminGolfSummary =
  z.infer<typeof AdminGolfSummarySchema>;
