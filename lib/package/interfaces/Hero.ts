import { z } from "zod";

export const heroSchema = z.object({
  name: z.string(),
  alias: z.string().optional(), // e.g., "Clark Kent"
  powers: z.array(z.string()), // ["flight", "strength", "x-ray vision"]
  weaknesses: z.array(z.string()).optional(), // ["kryptonite"]
  active: z.boolean(),
  rescues: z.number().int().nonnegative().optional(), // Number of rescues performed
});

export type Hero = z.infer<typeof heroSchema>;