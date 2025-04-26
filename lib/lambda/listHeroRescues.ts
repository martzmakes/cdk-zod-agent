import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { endpoints } from "../package/client/endpoints";
import { initApiHandler } from "../package/helpers/initApiHandler";
import { getDynamoClient } from "./dynamo";
import { Rescue, rescueSchema } from "../package/interfaces/Rescue";

// Extract the listHeroRescues endpoint from the endpoints object
const { listHeroRescues } = endpoints;
// Create the API handler using the endpoint's withHandler method
const { handler: apiHandler } = listHeroRescues.withHandler(
  async ({ pathParameters }) => {
    // Log the path parameters for debugging
    console.log("pathParameters:", pathParameters);
    // Extract the hero ID from the path parameters
    const { hero } = pathParameters;
    // If hero ID is not provided, return a 400 error
    if (!hero) {
      return {
        statusCode: 400,
        data: {
          message: "Hero ID is required",
        },
      };
    }

    // Initialize the DynamoDB client
    const ddb = getDynamoClient();
    try {
      // Query DynamoDB for rescues associated with the hero
      const { Items: rescues } = await ddb.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: "pk = :pk and begins_with(sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": "RESCUE",
            ":sk": `HERO#${hero}#`,
          },
        })
      );
      // If no rescues are found, return an empty array
      if (!rescues || rescues.length === 0) {
        return {
          statusCode: 200,
          data: {
            rescues: [] as Rescue[],
          },
        };
      }

      // Map and filter rescues to match the Rescue schema
      return {
        statusCode: 200,
        data: {
          rescues: rescues
            .map((rescue) => {
              // Remove pk, sk, and createdAt fields from the rescue object
              const { pk, sk, createdAt, ...rest } = rescue;
              return rest;
            })
            .filter((rescue) => {
              // Validate each rescue object using the rescueSchema
              const parsed = rescueSchema.safeParse(rescue);
              return parsed.success;
            }) as Rescue[],
        },
      };
    } catch (e) {
      // Handle errors and return a 500 response
      return {
        statusCode: 500,
        data: {
          error: e,
          message: "Error retrieving rescues",
        },
      };
    }
  }
);

// Export the handler wrapped with the API handler initializer
export const handler = initApiHandler({
  apiHandler,
});
