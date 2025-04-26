import { createApiClient } from "../helpers/endpoints";
import { endpoints } from "./endpoints";

const region = "us-east-1";
export const heroClient = (apiId: string) => createApiClient({
  endpoints,
  baseUrl: `https://${apiId}.execute-api.${region}.amazonaws.com/prod`,
});
