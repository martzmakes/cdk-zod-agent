import { z } from "zod";
import { defineZodEndpoint } from "../helpers/endpoints";
import { ListHeroRescuesResponseSchema } from "../interfaces/ListHeroRescues";
import { AddHeroRequestSchema } from "../interfaces/AddHeroRequest";
import { AddHeroResponseSchema } from "../interfaces/AddHeroResponse";
import { AddRescueRequestSchema } from "../interfaces/AddRescueRequest";
import { AddRescueResponseSchema } from "../interfaces/AddRescueResponse";
import { SearchHeroesRequestSchema } from "../interfaces/SearchHeroesRequest";
import { SearchHeroesResponseSchema } from "../interfaces/SearchHeroesResponse";

// Create a central endpoints map using the builder.
// Each property is inferred (e.g. "createUser" and "getUser").
export const endpoints = {
  listHeroRescues: defineZodEndpoint({
    path: "/heroes/{hero}/rescues",
    method: "GET",
    schemas: {
      request: z.null(),
      response: ListHeroRescuesResponseSchema,
    },
    description:
      "Get a list of rescues performed by a specific hero. The hero is specified in the path parameter.",
  }),
  addHero: defineZodEndpoint({
    path: "/heroes",
    method: "POST",
    schemas: {
      request: AddHeroRequestSchema,
      response: AddHeroResponseSchema,
    },
    description:
      "Add a new hero to the system. The hero details are provided in the request body.",
  }),
  addRescue: defineZodEndpoint({
    path: "/heroes/{hero}/rescues",
    method: "POST",
    schemas: {
      request: AddRescueRequestSchema,
      response: AddRescueResponseSchema,
    },
    description:
      "Add a rescue performed by a specific hero. The hero is specified in the path parameter, and the rescue details are provided in the request body.",
  }),
  searchHeroes: defineZodEndpoint({
    path: "/heroes/search",
    method: "POST",
    schemas: {
      request: SearchHeroesRequestSchema,
      response: SearchHeroesResponseSchema,
    },
    description:
      "Search for heroes based on various criteria. The search parameters are provided in the request body.",
  }),
};
