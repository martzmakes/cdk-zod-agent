import { z } from "zod";

export const heroSchema = z.object({
  name: z.string(),
  alias: z.string(), // e.g., "Clark Kent"
  powers: z.array(z.string()), // ["flight", "strength", "x-ray vision"]
  active: z.boolean(),
  rescues: z.number().int().nonnegative().optional(), // Number of rescues performed
});
