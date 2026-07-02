import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema/index";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL environment variable is not set");

// HTTP driver — used everywhere (auth, middleware, simple queries)
const sql = neon(url);
export const db = drizzleHttp(sql, { schema });

// Pool driver — used only for transactions in server actions
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: url });
export const dbPool = drizzlePool(pool, { schema });
