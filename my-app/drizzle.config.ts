import { defineConfig } from "drizzle-kit";
import { readFileSync } from "fs";

// drizzle-kit only auto-loads .env, not .env.local — load it manually
try {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
} catch {}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
