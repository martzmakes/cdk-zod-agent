import { APIGatewayEvent, Context } from "aws-lambda";
import { z } from "zod";

export interface ApiErrorResponse {
  message: string; // message for error messages
}

/**
 * Initializes an API handler for AWS Lambda.
 *
 * This function wraps a provided API handler function with common logic for processing API Gateway events.
 * It handles tasks such as:
 *
 * - Parsing and validating the incoming request body (using Zod schemas if provided).
 * - Logging the received event (unless disabled via `disableIncomingEventLog`).
 * - Optionally tracking events by publishing an ArchEvent if the `sourceFn` header is present and event
 *   tracking is not disabled.
 * - Instrumenting the handler with tracing (using AWS Lambda Powertools Tracer).
 * - Handling errors by logging them and returning a fallback error output if provided.
 *
 * The wrapped handler expects the incoming event's body to be a JSON string (if present), and it passes
 * to the API handler a parsed version of the body along with the event metadata (headers, HTTP method,
 * path, etc.). The API handler should return an object containing at least a `data` property (which will
 * be JSON-stringified), and may also include custom headers and a status code (defaulting to 200).
 *
 * @template TInput - The type of the expected input payload (after parsing and decoding).
 * @template TOutput - The type of the successful output from the API handler.
 *
 * @param {Object} options - The configuration object.
 * @param {ApiHandler<TInput, TOutput>} options.apiHandler - The function that processes the parsed request.
 * @param {z.ZodType<TInput>} [options.inputSchema] - An optional Zod schema to validate the request body against TInput.
 * @param {z.ZodType<TOutput>} [options.outputSchema] - An optional Zod schema to validate the response data against TOutput.
 *
 * @returns {Function} A Lambda handler function that accepts an APIGatewayEvent and Context, processes the event
 *                     using the provided API handler, and returns a response object containing a JSON-stringified body,
 *                     headers, and a status code.
 *
 * @example
 * // Define your request and response types:
 * interface DummyRequest {
 *   message: string;
 * }
 *
 * interface DummyResponse {
 *   response: string;
 * }
 *
 * // Create your API handler function:
 * const apiHandler: ApiHandler<DummyRequest, DummyResponse> = async ({ body }) => {
 *   return {
 *     statusCode: 200,
 *     data: { response: `Echo: ${body.message}` },
 *   };
 * };
 *
 * // Initialize the Lambda handler:
 * export const handler = initApiHandler({ 
 *   apiHandler,
 *   inputSchema: z.object({ message: z.string() }),
 *   outputSchema: z.object({ response: z.string() }),
 * });
 */
export type ApiHandler<TInput, TOutput> = (args: {
  body: TInput;
  event: APIGatewayEvent; // escape hatch
  headers: Record<string, string>;
  method: string;
  path: string;
  pathParameters: Record<string, string>;
  queryStringParameters: Record<string, string>;
}) => Promise<{
  data: TOutput | ApiErrorResponse;
  headers?: Record<string, string>;
  statusCode?: number; // default to 200
}>;

export const initApiHandler = <TInput, TOutput>({
  apiHandler,
  inputSchema,
  outputSchema,
}: {
  apiHandler: ApiHandler<TInput, TOutput>;
  inputSchema?: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
}) => {
  return async (event: APIGatewayEvent, context: Context) => {
    let handlerOutput;
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      
      // Validate input against schema if enabled and provided
      let validatedInput: TInput;
      if (inputSchema && event.body) {
        validatedInput = inputSchema.parse(body);
      } else {
        validatedInput = body as TInput;
      }
      const headers = (event.headers || {}) as Record<string, string>;
      handlerOutput = await apiHandler({
        event,
        body: validatedInput,
        headers,
        method: event.httpMethod,
        path: event.path,
        pathParameters: (event.pathParameters || {}) as Record<string, string>,
        queryStringParameters: (event.queryStringParameters || {}) as Record<
          string,
          string
        >,
      });
      
      // Validate output against schema if enabled, provided, and data is not a string
      if (outputSchema && handlerOutput && typeof handlerOutput.data !== "string") {
        try {
          handlerOutput.data = outputSchema.parse(handlerOutput.data);
        } catch (err) {
          return { statusCode: 500, body: "Internal server error" };
        }
      }
    } catch (err) {
      console.error("Error in API handler:", err);
    }

    if (!handlerOutput)
      return { statusCode: 500, body: "Unknown error" };

    return {
      body:
        typeof handlerOutput.data === "string"
          ? handlerOutput.data
          : JSON.stringify(handlerOutput.data),
      headers: handlerOutput.headers,
      statusCode: handlerOutput.statusCode || 200,
    };
  };
};
