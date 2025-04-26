import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { EventBus } from "aws-cdk-lib/aws-events";
import { DynamoAccessProps, LambdaProps } from "../interfaces/LambdaProps";
import * as path from "path";

export class Lambda extends Construct {
  fn: NodejsFunction;
  name: string;
  timeout: Duration;

  static basename(props: LambdaProps) {
    return path.basename(props.entry, path.extname(props.entry));
  }

  constructor(scope: any, id: string, props: LambdaProps) {
    super(scope, id);

    const name = props.entry.split("/").pop()?.split(".")[0];
    const functionName = `${name}`;
    this.name = functionName;
    const logGroup = new LogGroup(this, `${functionName}Logs`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.timeout = props.timeout || Duration.minutes(15);

    const fn = new NodejsFunction(this, `${name}Fn`, {
      functionName,
      runtime: Runtime.NODEJS_22_X,
      memorySize: 1024,
      timeout: this.timeout,
      architecture: Architecture.ARM_64,
      retryAttempts: 0,
      logGroup,
      ...props,
    });

    // All lambdas should have access to publish to the event bus
    const bus = EventBus.fromEventBusName(this, "EventBus", "default");
    bus.grantPutEventsTo(fn);

    if (props.dynamos) this.addDynamoAccess(props.dynamos);
  }

  addDynamoAccess(tables: DynamoAccessProps) {
    Object.entries(tables).forEach(([key, value]) => {
      if (value.access === "r") {
        value.table.grantReadData(this.fn);
      } else if (value.access === "w") {
        value.table.grantWriteData(this.fn);
      } else if (value.access === "rw") {
        value.table.grantReadWriteData(this.fn);
      }
      this.fn.addEnvironment(key, value.table.tableName);
    });
  }
}