import { ITable } from "aws-cdk-lib/aws-dynamodb";

import { endpoints as packageEndpoints } from "../package/client/endpoints";
import { EndpointLambda } from "../interfaces/EndpointLambda";
import { join } from "path";

export const endpoints = ({ table }: { table: ITable }): EndpointLambda[] => [
  {
    ...packageEndpoints.addHero.endpoint,
    entry: join(__dirname, "./addHero.ts"),
    dynamos: {
      TABLE_NAME: {
        table,
        access: "rw",
      },
    },
  },
  {
    ...packageEndpoints.addRescue.endpoint,
    entry: join(__dirname, "./addRescue.ts"),
    dynamos: {
      TABLE_NAME: {
        table,
        access: "rw",
      },
    },
  },
  {
    ...packageEndpoints.listHeroRescues.endpoint,
    entry: join(__dirname, "./listHeroRescues.ts"),
    dynamos: {
      TABLE_NAME: {
        table,
        access: "r",
      },
    },
  },
  {
    ...packageEndpoints.searchHeroes.endpoint,
    entry: join(__dirname, "./searchHeroes.ts"),
    dynamos: {
      TABLE_NAME: {
        table,
        access: "r",
      },
    },
  },
];
