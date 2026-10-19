import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;
// Legacy timestamp columns follow the academy's UTC storage convention.
// Keep plain DATE fields (e.g. birth date) and TIMESTAMPTZ parsing unchanged.
const parseInstant = pg.types.getTypeParser(1184);
pg.types.setTypeParser(1114, value => parseInstant(/^-?infinity$/i.test(value) ? value : value + 'Z'));
pg.defaults.parseInputDatesAsUTC = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: "-c timezone=UTC", max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 15000 });
export const db = drizzle(pool, { schema });
