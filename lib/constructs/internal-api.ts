import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  AuthorizationType,
  EndpointType,
  LambdaIntegration,
  MethodLoggingLevel,
  RestApi,
  Resource,
  AccessLogFormat,
  LogGroupLogDestination,
} from "aws-cdk-lib/aws-apigateway";
import {
  AccountPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { Lambda } from "./lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { EndpointLambda } from "../interfaces/EndpointLambda";

export interface ApiProps {
  endpoints?: EndpointLambda[];
  name: string;
}

export class InternalApi extends Construct {
  endpointsLambda?: EndpointLambda[];
  lambdas: Record<string, Lambda> = {};
  resources: Record<string, Resource> = {};
  restApi: RestApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.endpointsLambda = props.endpoints;

    const { name } = props;

    const logs = new LogGroup(this, `/${name}ApiLogs`, {
      logGroupName: `/${name}Api`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const authorizationType = AuthorizationType.IAM; // Default to IAM authorization

    this.restApi = new RestApi(this, `${name}Api`, {
      description: `API for ${name}`,
      defaultMethodOptions: { authorizationType },
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ["execute-api:Invoke"],
            effect: Effect.ALLOW,
            principals: [new AccountPrincipal(Stack.of(this).account)],
          }),
        ],
      }),
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
      deployOptions: {
        dataTraceEnabled: true,
        tracingEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new LogGroupLogDestination(logs),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: MethodLoggingLevel.INFO,
      },
    });

    this.processLambdaEndpoints(props.endpoints || []);
  }

  processLambdaEndpoints(lambdaEndpoints: EndpointLambda[]): void {
    lambdaEndpoints.forEach((endpoint) => {
      // remove leading slash
      const path = endpoint.path.startsWith("/")
        ? endpoint.path.slice(1)
        : endpoint.path;
      this.createEndpointPath({
        path,
      });
      const resource = this.resources[path];
      const lambda = this.createEndpointFn({
        endpoint,
      });

      resource.addMethod(endpoint.method, new LambdaIntegration(lambda.fn), {
        authorizationType: AuthorizationType.IAM,
      });
    });
  }

  createEndpointPath({ path }: { path: string }): void {
    const pathParts = path.split("/").filter((pathPart) => !!pathPart);
    let currentPath = "";
    pathParts.forEach((pathPart, ind) => {
      if (pathPart) {
        if (ind === 0) {
          currentPath = pathPart;
          if (!this.resources[currentPath]) {
            this.resources[currentPath] =
              this.restApi.root.addResource(pathPart);
          }
        } else {
          currentPath += `${ind !== 0 ? "/" : ""}${pathPart}`;
          if (!this.resources[currentPath]) {
            this.resources[currentPath] =
              this.resources[
                currentPath.substring(0, currentPath.lastIndexOf("/"))
              ].addResource(pathPart);
          }
        }
      }
    });
  }

  createEndpointFn({ endpoint }: { endpoint: EndpointLambda }): Lambda {
    const name = Lambda.basename(endpoint);
    const lambda = new Lambda(this, `${name}Fn`, {
      timeout: Duration.seconds(30),
      description: `${this.restApi.restApiName}`,
      ...endpoint,
    });
    this.lambdas[name] = lambda;
    return lambda;
  }
}
