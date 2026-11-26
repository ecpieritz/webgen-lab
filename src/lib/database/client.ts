import "server-only";

import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a PostgreSQL connection string.",
    ),
});

let databaseClient: NeonQueryFunction<false, false> | undefined;

export function getDatabase(): NeonQueryFunction<false, false> {
  if (databaseClient) return databaseClient;

  const environment = databaseEnvironmentSchema.safeParse(process.env);

  if (!environment.success) {
    throw new Error("The database server configuration is missing or invalid.");
  }

  databaseClient = neon(environment.data.DATABASE_URL);

  return databaseClient;
}
