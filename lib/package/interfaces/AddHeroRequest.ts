import { z } from "zod";
import { heroSchema } from "./Hero";

export const AddHeroRequestSchema = heroSchema.omit({ rescues: true });

export type AddHeroRequest = z.infer<typeof AddHeroRequestSchema>;
