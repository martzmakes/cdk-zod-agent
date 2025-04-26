import { z } from "zod";

export const rescueSchema = z.object({
  hero: z.string(), // e.g., "Superman"
  location: z.string(), // e.g., "Metropolis"
  date: z.string().optional(), // ISO date string, e.g., "2023-10-01"
  description: z.string().optional(), // e.g., "Rescued citizens from a burning building"
  details: z.string().optional(), // Additional details about the rescue
});

export type Rescue = z.infer<typeof rescueSchema>;