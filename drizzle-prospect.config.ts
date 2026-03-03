import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/prospect-agent/db/schema.ts",
  out: "./drizzle-prospect",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_PROSPECT_DATABASE_URL!,
    authToken: process.env.TURSO_PROSPECT_AUTH_TOKEN,
  },
});
