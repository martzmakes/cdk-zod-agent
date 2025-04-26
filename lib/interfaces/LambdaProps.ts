import { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";

export interface DynamoAccessProps {
  [key: string]: {
    table: ITableV2;
    access: "r" | "w" | "rw";
  };
}

export interface LambdaProps extends NodejsFunctionProps {
  dynamos?: DynamoAccessProps;
  entry: string;
}