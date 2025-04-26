import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Dynamo } from "./constructs/dynamo";
import { InternalApi } from "./constructs/internal-api";
import { endpoints } from "./lambda/routes";

export class CdkZodAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dynamo = new Dynamo(this, "ZodTable");
    new InternalApi(this, "ZodApi", {
      endpoints: endpoints({
        table: dynamo.table,
      }),
    });
  }
}
