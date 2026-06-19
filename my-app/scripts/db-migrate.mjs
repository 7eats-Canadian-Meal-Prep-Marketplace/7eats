/**
 * Apply Drizzle SQL migrations via Neon WebSocket (required in Node.js).
 * drizzle-kit migrate uses HTTP and fails silently on Windows/Neon — use this instead.
 *
 * Run: pnpm db:migrate
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(root, ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    // .env.local optional if DATABASE_URL is already in the environment
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to my-app/.env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

try {
  console.log("Applying migrations from db/migrations …");
  await migrate(db, { migrationsFolder: resolve(root, "db/migrations") });
  console.log("All migrations applied successfully.");
} catch (err) {
  console.error("Migration failed:");
  console.error(err);
  process.exit(1);
} finally {
  await pool.end();
}
