import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";

/**
 * Retrieves AWS SSO credentials using the AWS SDK credential provider for SSO.
 *
 * If the AWS_PROFILE environment variable is not set, logs an error and throws.
 *
 * @returns {Promise<any>} A promise that resolves to the obtained SSO credentials.
 * @throws {Error} If AWS_PROFILE is not set.
 *
 * @example
 * const credentials = await getSSOCredentials();
 */
export const getSSOCredentials = async (): Promise<any> => {
  if (!process.env.AWS_PROFILE) {
    const message = "AWS_PROFILE is not set, possibly not using SSO or not logged in";
    console.error(message);
    throw new Error(message);
  }
  const { fromSSO } = await import("@aws-sdk/credential-provider-sso");
  const credentials = fromSSO({
    profile: process.env.AWS_PROFILE,
  });

  return await credentials();
};


/**
 * Signs an HttpRequest using SignatureV4.
 *
 * If AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY are missing from the environment, it attempts
 * to retrieve SSO credentials. Then, a new SignatureV4 signer is created and used to sign the request.
 *
 * @param {HttpRequest} request - The HTTP request to sign.
 * @returns {Promise<HttpRequest>} A promise that resolves to the signed HttpRequest.
 *
 * @example
 * const signedRequest = await signRequest(request);
 */
export const signRequest = async (
  request: HttpRequest
): Promise<HttpRequest> => {
  let credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  } as any;
  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    // try to get SSO credentials
    credentials = await getSSOCredentials();
  }
  const v4 = new SignatureV4({
    service: "execute-api",
    region: process.env.AWS_DEFAULT_REGION || "",
    credentials,
    sha256: Sha256,
  });
  const signedRequest = await v4.sign(request);
  return signedRequest as HttpRequest;
};

/**
 * Makes an IAM request by constructing, signing, and sending an HTTP request.
 *
 * Builds an HttpRequest using the provided parameters, signs it with signRequest, and sends it using fetch.
 * If the response is not OK and its status is not among the allowedStatusCodes (default: [404]),
 * an error is thrown.
 *
 * @param {Object} args - The parameters for the IAM request.
 * @param {string} args.domain - The domain to which the request is sent (e.g. "https://example.com").
 * @param {string} args.path - The path for the request.
 * @param {string} [args.body] - Optional request body.
 * @param {Record<string, string>} [args.headers] - Optional additional headers.
 * @param {string} [args.method] - HTTP method to use (default: "GET").
 * @param {Record<string, string | string[] | null>} [args.query] - Optional query parameters.
 * @param {number[]} [args.allowedStatusCodes] - Allowed non-OK status codes (default: [404]).
 * @returns {Promise<Response>} A promise that resolves to the fetch Response.
 *
 * @throws {Error} If domain or path are missing, or if the response status is not allowed.
 *
 * @example
 * const response = await makeIAMRequest({
 *   domain: "https://api.example.com",
 *   path: "v1/resource",
 *   method: "POST",
 *   body: JSON.stringify({ key: "value" }),
 *   query: { q: "search" }
 * });
 */
export const makeIAMRequest = async (args: {
  body?: string;
  domain: string;
  headers?: Record<string, string>;
  method?: string;
  path: string;
  query?: Record<string, string | Array<string> | null>;
  allowedStatusCodes?: number[];
}): Promise<Response> => {
  const fnName = "makeIAMRequest";
  try {
    console.info({ message: `${fnName} args`, data: { args } });
    if (!args.domain) { throw new Error("No domain provided"); }
    if (!args.path)   { throw new Error("No path provided"); }

    const { domain: incomingDomain, method, path, query } = args;
    const cleanDomain = incomingDomain.replace("https://", "");
    const domain = cleanDomain.endsWith("/")
      ? cleanDomain.slice(0, -1)
      : cleanDomain;

    const url = new URL(`https://${domain}/${path}`);
    const request = new HttpRequest({
      hostname: url.host,
      method: method || "GET",
      headers: {
        host: url.host,
        ...(args.body ? { "Content-Type": "application/json" } : {}),
        sourceFn: process.env.AWS_LAMBDA_FUNCTION_NAME || "",
        ...args.headers,
      },
      path: url.pathname,
      body: args.body,
      query: query,
    });

    console.info({ message: `${fnName} request`, data: { request } });
    const signedRequest = await signRequest(request);

    const reqUrl = new URL(url.href);
    reqUrl.search = new URLSearchParams(
      query as Record<string, string>
    ).toString();

    const res = await fetch(`${url.href}${reqUrl.search}`, signedRequest);
    if (!res.ok) {
      const allowedStatusCodes = args.allowedStatusCodes || [404];
      if (!allowedStatusCodes.includes(res.status)) {
        const text = await res.text();
        throw new Error(`Error making IAM request - status: ${res.status} (${res.statusText}), reason: ${text}`);
      }
    }
    return res;
  } catch (e) {
    console.error({
      message: `Error making IAM request`,
      error: e as Error,
      data: {
        args,
      },
    });
    throw e;
  }
};
