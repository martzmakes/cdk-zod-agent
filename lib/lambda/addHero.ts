// This Lambda function handles adding a new hero to the DynamoDB table.
// It uses AWS SDK v3's PutCommand to insert a new item, ensuring uniqueness by name.
// The handler is wrapped with API handler utilities for consistent API responses.

import { PutCommand } from "@aws-sdk/lib-dynamodb"; // Import DynamoDB PutCommand
import { endpoints } from "../package/client/endpoints"; // Import API endpoint definitions
import { initApiHandler } from "../package/helpers/initApiHandler"; // Import API handler initializer
import { getDynamoClient } from "./dynamo"; // Import function to get DynamoDB client

const { addHero } = endpoints; // Destructure addHero endpoint

// Define the Lambda handler for the addHero endpoint
const { handler: apiHandler } = addHero.withHandler(async ({ body }) => {
  // Log the request body for debugging
  console.log("body:", body);
  const ddb = getDynamoClient(); // Get DynamoDB client instance

  try {
    // Attempt to insert the new hero into the DynamoDB table
    // The ConditionExpression ensures that a hero with the same pk/sk does not already exist
    const { Attributes: hero } = await ddb.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME, // Table name from environment variable
        Item: {
          pk: "HERO", // Partition key for hero
          sk: body.name, // Sort key is the hero's name
          ...body, // Spread the rest of the hero properties from the request body
          rescues: 0, // Initialize rescues count
          createdAt: new Date().toISOString(), // Set creation timestamp
        },
        ConditionExpression:
          "attribute_not_exists(pk) AND attribute_not_exists(sk)", // Ensure uniqueness
      })
    );
    // Return a success response with the created hero
    return {
      statusCode: 200,
      data: {
        hero,
        success: true,
        message: "Hero created successfully",
      },
    };
  } catch (e) {
    // If the hero already exists or another error occurs, return a failure response
    return {
      statusCode: 400,
      data: {
        hero: body,
        success: false,
        error: e,
        message: "Hero already exists",
      },
    };
  }

  // Fallback response (should not be reached)
  return {
    statusCode: 200,
    data: { message: "TODO" },
  };
});

// Export the Lambda handler, wrapped with the API handler initializer
export const handler = initApiHandler({
  apiHandler,
});
