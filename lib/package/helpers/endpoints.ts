import { APIGatewayEvent } from "aws-lambda";
import { ApiErrorResponse, ApiHandler } from "./initApiHandler";
import { z } from "zod";
import { iamRequest } from "./iamRequest";

/**
 * Given a path string like "/users/{userId}/posts/{postId}",
 * returns a Zod object schema for the path parameters.
 * Example: zodPathParametersSchema("/users/{userId}/posts/{postId}")
 *   => z.object({ userId: z.string(), postId: z.string() })
 */
export function zodPathParametersSchema<Path extends string>(
  path: Path
): z.ZodObject<any> {
  // Match all occurrences of {paramName}
  const paramRegex = /\{([^}]+)\}/g;
  const params: Record<string, z.ZodTypeAny> = {};
  let match: RegExpExecArray | null;
  while ((match = paramRegex.exec(path)) !== null) {
    params[match[1]] = z.string();
  }
  return z.object(params);
}

// Type inference helpers for Zod schemas
export type InferZodType<T extends z.ZodType> = z.infer<T>;

// Allowed HTTP methods.
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// Given a literal like "/users/{userId}", extract path parameters as a type.
export type ExtractPathParameters<T extends string> =
  T extends `${infer _Start}{${infer Param}}${infer Rest}`
    ? { [K in Param | keyof ExtractPathParameters<Rest>]: string }
    : {};

// An endpoint's pure configuration (shared by client and server).
// Now supports either explicit types or Zod schemas
export interface ApiEndpointDefinition<Req, Res, Path extends string = "/"> {
  path: Path;
  method: HttpMethod;
  description?: string; // Optional description for the endpoint
  // Optional Zod schemas for request and response
  requestSchema?: z.ZodType<Req>;
  responseSchema?: z.ZodType<Res>;
}

// A handler function processes a request and returns a promise of the response.
export interface ImprovedApiHandler<Req, Res, PathParams = {}>
  extends ApiHandler<Req, Res> {
  (params: {
    pathParameters: PathParams;
    body: Req;
    event: APIGatewayEvent; // escape hatch
    headers: Record<string, string>;
    method: string;
    path: string;
    queryStringParameters: Record<string, string>;
    logStreamUrl: string;
  }): Promise<{
    data: Res | ApiErrorResponse;
    headers?: Record<string, string>;
    statusCode?: number; // default to 200
  }>;
}

// An endpoint with an attached handler (server-only).
export interface ApiEndpointWithHandler<Req, Res, Path extends string>
  extends ApiEndpointDefinition<Req, Res, Path> {
  handler: ImprovedApiHandler<Req, Res, ExtractPathParameters<Path>>;
}

// The builder holds the pure endpoint plus a method to attach the handler.
export interface EndpointBuilder<Req, Res, Path extends string> {
  // The pure endpoint configuration.
  endpoint: ApiEndpointDefinition<Req, Res, Path>;
  // Attach a handler, returning an object that has both the configuration and runtime code.
  withHandler(
    handler: ImprovedApiHandler<Req, Res, ExtractPathParameters<Path>>
  ): ApiEndpointWithHandler<Req, Res, Path>;
}

// A helper function to define an endpoint with a given path and method using Zod schemas

/**
 * Defines an endpoint using Zod schemas.
 * Supports both the old signature and a new single-argument object signature for backwards compatibility.
 */
export function defineZodEndpoint<
  Path extends string,
  ReqSchema extends z.ZodType,
  ResSchema extends z.ZodType
>(args: {
  path: Path;
  method: HttpMethod;
  schemas: { request: ReqSchema; response: ResSchema };
  description?: string;
}): EndpointBuilder<z.infer<ReqSchema>, z.infer<ResSchema>, Path> {
  const { path, method, schemas, description } = args;

  type Req = z.infer<typeof schemas.request>;
  type Res = z.infer<typeof schemas.response>;

  const endpoint: ApiEndpointDefinition<Req, Res, typeof path> = {
    path,
    method,
    requestSchema: schemas.request,
    responseSchema: schemas.response,
    description,
  };

  return {
    endpoint,
    withHandler(
      handler: ImprovedApiHandler<Req, Res, ExtractPathParameters<typeof path>>
    ) {
      return { ...endpoint, handler };
    },
  };
}

// This mapped type builds a client method for every endpoint key.
export type GeneratedApiClient<
  EP extends Record<string, { endpoint: ApiEndpointDefinition<any, any, any> }>
> = {
  [K in keyof EP]: EP[K]["endpoint"] extends ApiEndpointDefinition<
    infer Req,
    infer Res,
    infer Path
  >
    ? EP[K]["endpoint"]["method"] extends "GET" | "DELETE"
      ? ((params: {
          pathParameters: ExtractPathParameters<Path>;
        }) => Promise<Res>) & {
          endpointName: string;
          description?: string;
          requestSchema?: z.ZodType;
          responseSchema?: z.ZodType;
          pathParametersSchema?: z.ZodType;
        }
      : ((params: {
          body: Req;
          pathParameters: ExtractPathParameters<Path>;
        }) => Promise<Res>) & {
          endpointName: string;
          description?: string;
          requestSchema?: z.ZodType;
          responseSchema?: z.ZodType;
          pathParametersSchema?: z.ZodType;
        }
    : never;
};

/**
 * Builds a client function for an API endpoint.
 *
 * This function creates a typed client function that can be used to make requests to an API endpoint.
 * If a Zod schema is provided, it will validate the request body against the schema before sending the request.
 *
 * @template Req - The request body type
 * @template Res - The response type
 * @template Path - The endpoint path type
 * @param options - The options for building the client function
 * @param options.domain - The domain to send requests to
 * @param options.endpoint - The endpoint definition
 * @param options.key - The key for the endpoint (used in logging)
 * @returns A function that makes requests to the endpoint
 */
function buildClientFunction<Req, Res, Path extends string>({
  domain,
  endpoint,
  key,
}: {
  domain: string;
  endpoint: ApiEndpointDefinition<Req, Res, Path>;
  key: string;
}): (params: {
  body?: Req;
  pathParameters: ExtractPathParameters<Path>;
}) => Promise<Res> {
  return async (params: {
    body?: Req;
    headers?: Record<string, string>;
    pathParameters: ExtractPathParameters<Path>;
    query?: Record<string, string | Array<string> | null>;
  }) => {
    // Validate body with Zod if schema is provided and body exists
    if (endpoint.requestSchema && params.body) {
      const validationResult = endpoint.requestSchema.safeParse(params.body);
      if (!validationResult.success) {
        const errorMessage = `Validation error in apiClient.${key}: ${validationResult.error.message}`;
        console.error({
          message: errorMessage,
          data: {
            errors: validationResult.error.errors,
            body: params.body,
          },
        });
        throw new Error(errorMessage);
      }
    }
    // Build the URL by replacing the parameters.
    let url = endpoint.path;
    if (!url.startsWith("/")) {
      url = `/${url}` as Path;
    }
    for (const [param, value] of Object.entries(params.pathParameters || {})) {
      url = url.replace(`{${param}}`, encodeURIComponent(value)) as Path;
    }
    const start = new Date().getTime();
    const response = await iamRequest<Res>({
      domain,
      method: endpoint.method,
      headers: params.headers,
      path: url,
      query: params.query,
      body: params.body ? JSON.stringify(params.body) : undefined,
    });

    // Validate response with Zod if schema is provided
    if (endpoint.responseSchema) {
      const validationResult = endpoint.responseSchema.safeParse(response);
      if (!validationResult.success) {
        const errorMessage = `Response validation error in apiClient.${key}: ${validationResult.error.message}`;
        console.error({
          message: errorMessage,
          data: {
            errors: validationResult.error.errors,
            response,
          },
        });
        // We don't throw here, just log the error
      }
    }

    const end = new Date().getTime();
    const duration = end - start;
    console.info({
      message: `apiClient.${key}`,
      data: {
        duration,
        method: endpoint.method,
        url: `${domain}${url}`,
      },
    });
    return response as Res;
  };
}

/**
 * Creates an API client with typed methods for each endpoint.
 *
 * This function creates a client object with methods for each endpoint in the provided endpoints object.
 * Each method is typed according to the endpoint's request and response types.
 * Zod schemas from the endpoint definitions will be used to validate request bodies and responses.
 *
 * @template EP - The endpoints record type
 * @param options - The options for creating the API client
 * @param options.endpoints - The endpoints to create methods for
 * @param options.envMap - A map of environment names to domains
 * @returns An API client with typed methods for each endpoint
 */
export function createApiClient<
  EP extends Record<string, { endpoint: ApiEndpointDefinition<any, any, any> }>
>({
  endpoints,
  baseUrl,
}: {
  endpoints: EP;
  baseUrl: string;
}): GeneratedApiClient<EP> {
  const client = {} as GeneratedApiClient<EP>;
  for (const key in endpoints) {
    // Use the helper to create a properly typed function.
    const fn = buildClientFunction({
      domain: baseUrl,
      endpoint: endpoints[key].endpoint,
      key,
    }) as any;
    // Attach metadata from the endpoint definition
    fn.description = endpoints[key].endpoint.description;
    fn.endpointName = key;
    fn.requestSchema = endpoints[key].endpoint.requestSchema;
    fn.responseSchema = endpoints[key].endpoint.responseSchema;
    fn.pathParametersSchema = zodPathParametersSchema(
      endpoints[key].endpoint.path
    );
    client[key] = fn;
  }
  return client;
}

/*
// Example of using the new Zod-based endpoint definition
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
});

const CreateUserResponseSchema = z.object({
  success: z.boolean(),
  user: UserSchema,
});

export const endpoints = {
  // Example using explicit types (legacy approach)
  createUserLegacy: defineEndpoint<any, any, "/users/{userId}">(
    "/users/{userId}",
    "POST"
  ),

  // Example using Zod schemas (new approach)
  createUser: defineZodEndpoint("/users/{userId}", "POST", {
    request: UserSchema,
    response: CreateUserResponseSchema,
  }),
};

const client = createApiClient({
  endpoints,
  baseUrl "https://dev.example.com"
});
client.createUser.pathParametersSchema
*/
