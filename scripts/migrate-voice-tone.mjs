import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^"|"$/g, "")];
    })
);

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

try {
  await client.execute("ALTER TABLE workspace_profiles ADD COLUMN voice_tone TEXT");
  console.log("Migration applied: voice_tone column added.");
} catch (e) {
  if (e.message?.includes("duplicate column")) {
    console.log("Column already exists, skipping.");
  } else {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
