import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { endpoints } from "../package/client/endpoints";
import { initApiHandler } from "../package/helpers/initApiHandler";
import { getDynamoClient } from "./dynamo";
import { Hero, heroSchema } from "../package/interfaces/Hero";

const { searchHeroes } = endpoints;
// Set up the API handler for the searchHeroes endpoint
const { handler: apiHandler } = searchHeroes.withHandler(
  async ({ body }) => {
    // Log the path parameters for debugging
    console.log("body:", body);

    // Initialize DynamoDB client
    const ddb = getDynamoClient();
    try {
      // Build filter expression from body
      let FilterExpression;
      // Set up initial expression attribute values for partition key
      let ExpressionAttributeValues: Record<string, any> = { ':pk': 'HERO' };
      let ExpressionAttributeNames: Record<string, string> = {};
      // If there are filters in the request body, build filter expressions
      if (body && Object.keys(body).length > 0) {
        const filters = [];
        for (const [key, value] of Object.entries(body)) {
          const attrName = `#${key}`;
          const attrValue = `:${key}`;
          filters.push(`${attrName} = ${attrValue}`);
          ExpressionAttributeNames[attrName] = key;
          ExpressionAttributeValues[attrValue] = value;
        }
        // Join all filters with AND
        FilterExpression = filters.join(' AND ');
      }

      // Prepare the DynamoDB query input
      const queryInput: any = {
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues,
      };
      // If there are filter expressions, add them to the query input
      if (FilterExpression) {
        queryInput.FilterExpression = FilterExpression;
        queryInput.ExpressionAttributeNames = ExpressionAttributeNames;
      }

      // Execute the query command
      const { Items: heroes } = await ddb.send(new QueryCommand(queryInput));
      // If no heroes are found, return an empty array
      if (!heroes || heroes.length === 0) {
        return {
          statusCode: 200,
          data: {
            heroes: [] as Hero[],
          },
        };
      }

      // Return the list of heroes, filtering and validating with Zod schema
      return {
        statusCode: 200,
        data: {
          heroes: heroes
            .map((hero) => {
              // Remove DynamoDB keys and metadata
              const { pk, sk, createdAt, ...rest } = hero;
              return rest;
            })
            .filter((hero) => {
              // Validate each hero object
              const parsed = heroSchema.safeParse(hero);
              return parsed.success;
            }) as Hero[],
        },
      };
    } catch (e) {
      // Handle errors and return a 500 response
      return {
        statusCode: 500,
        data: {
          error: e,
          message: "Error retrieving heroes",
        },
      };
    }
  }
);

// Export the Lambda handler using the API handler
export const handler = initApiHandler({
  apiHandler,
});
