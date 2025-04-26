import { z } from "zod";
import { heroSchema } from "./Hero";

export const AddHeroResponseSchema = z.object({
  hero: heroSchema,
  success: z.boolean().optional(), // Indicates if the hero was added successfully
  message: z.string().optional(), // Optional message, e.g., "Hero added successfully"
  error: z.string().optional(), // Optional error message if the addition failed
});

export type AddHeroResponse = z.infer<typeof AddHeroResponseSchema>;
