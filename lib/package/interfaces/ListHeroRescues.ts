import { z } from "zod";
import { rescueSchema } from "./Rescue";

export const ListHeroRescuesResponseSchema = z.object({
  rescues: z.array(rescueSchema),
});

export type ListHeroRescuesResponse = z.infer<typeof ListHeroRescuesResponseSchema>;
