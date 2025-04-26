import { z } from "zod";

export const SearchHeroesRequestSchema = z.object({
  city: z.string().optional(),       // e.g., "Metropolis"
  status: z.enum(["active", "retired"]).optional(), // e.g., "active"
});

export type SearchHeroesRequest = z.infer<typeof SearchHeroesRequestSchema>;
