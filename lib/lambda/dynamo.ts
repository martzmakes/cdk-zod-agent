import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const translateConfig = {
  marshallOptions: {
    convertEmptyValues: false, // Automatically convert empty strings, blobs, and sets to `null`
    removeUndefinedValues: true, // Remove undefined values while marshalling
    convertClassInstanceToMap: true, // Convert class instances to map attributes
  },
  unmarshallOptions: {
    wrapNumbers: false, // Wrap numbers as strings instead of converting to native numbers
  }
};

let cachedDynamoClient: DynamoDBDocumentClient;
export function getDynamoClient(): DynamoDBDocumentClient {
  if (!cachedDynamoClient) {
    const client = new DynamoDBClient({});
    cachedDynamoClient = DynamoDBDocumentClient.from(client, translateConfig);
  }
  return cachedDynamoClient;
}
