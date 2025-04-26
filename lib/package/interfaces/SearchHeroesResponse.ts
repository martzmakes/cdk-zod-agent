import { z } from "zod";
import { heroSchema } from "./Hero";

export const SearchHeroesResponseSchema = z.object({
  heroes: z.array(heroSchema),
});

export type SearchHeroesResponse = z.infer<typeof SearchHeroesResponseSchema>;
