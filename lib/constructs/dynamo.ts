import { RemovalPolicy } from "aws-cdk-lib";
import {
  AttributeType,
  TableV2,
  TablePropsV2,
} from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class Dynamo extends Construct {
  table: TableV2;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    let tableProps: TablePropsV2 = {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    };

    this.table = new TableV2(this, "Table", tableProps);
  }
}
