// Lambda function to add a new rescue and update the hero's rescue count
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"; // Import DynamoDB commands
import { endpoints } from "../package/client/endpoints"; // Import API endpoints
import { initApiHandler } from "../package/helpers/initApiHandler"; // Import API handler initializer
import { getDynamoClient } from "./dynamo"; // Import DynamoDB client factory

const { addRescue } = endpoints; // Get the addRescue endpoint
const { handler: apiHandler } = addRescue.withHandler(async ({ body }) => {
  // Log the request body for debugging
  console.log("body:", body);
  const ddb = getDynamoClient(); // Get DynamoDB client

  try {
    // Generate a unique ID for the rescue
    const uuid = crypto.randomUUID();
    // Attempt to create a new rescue record in DynamoDB
    await ddb.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME, // DynamoDB table name
        Item: {
          pk: "RESCUE", // Partition key for rescues
          sk: `HERO#${body.hero}#${uuid}`, // Sort key: hero and uuid
          ...body, // Spread the request body fields
          createdAt: new Date().toISOString(), // Timestamp
        },
        ConditionExpression:
          "attribute_not_exists(pk) AND attribute_not_exists(sk)", // Ensure item does not already exist
      })
    );
    // If rescue was created, increment the hero's rescue count
    // This could also be done with a Change Data Capture Event...
    const { Attributes: hero } = await ddb.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME, // DynamoDB table name
        Key: {
          pk: "HERO", // Partition key for hero
          sk: body.hero, // Sort key: hero ID
        },
        UpdateExpression:
          "SET rescues = if_not_exists(rescues, :zero) + :one, updatedAt = :updatedAt", // Increment rescues and update timestamp
        ExpressionAttributeValues: {
          ":one": 1, // Increment by 1
          ":zero": 0, // Default value if rescues does not exist
          ":updatedAt": new Date().toISOString(), // Timestamp
        },
        ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)", // Ensure hero exists
        ReturnValues: "ALL_NEW", // Return the updated hero
      })
    );
    // Return a success response with the new rescue and updated hero
    return {
      statusCode: 200,
      data: {
        rescue: body,
        hero,
        success: true,
        message: "Rescue created successfully",
      },
    };
  } catch (e) {
    // Handle errors (e.g., rescue already exists)
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

// Export the Lambda handler using the API handler initializer
export const handler = initApiHandler({
  apiHandler,
});
