import { LambdaProps } from './LambdaProps';

export interface EndpointLambda extends LambdaProps {
  method: string;
  path: string;
}
