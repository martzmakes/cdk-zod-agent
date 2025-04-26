import { z } from "zod";
import { rescueSchema } from "./Rescue";

export const AddRescueRequestSchema = rescueSchema;

export type AddRescueRequest = z.infer<typeof AddRescueRequestSchema>;
