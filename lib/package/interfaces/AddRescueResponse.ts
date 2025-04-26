import { z } from "zod";
import { rescueSchema } from "./Rescue";
import { heroSchema } from "./Hero";

export const AddRescueResponseSchema = z.object({
  rescue: rescueSchema,
  hero: heroSchema.optional(),
  success: z.boolean().optional(), // Indicates if the hero was added successfully
  message: z.string().optional(), // Optional message, e.g., "Hero added successfully"
  error: z.string().optional(), // Optional error message if the addition failed
});

export type AddRescueResponse = z.infer<typeof AddRescueResponseSchema>;
