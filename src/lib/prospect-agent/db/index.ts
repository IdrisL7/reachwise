import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_PROSPECT_DATABASE_URL;
    if (!url) {
      throw new Error(
        "TURSO_PROSPECT_DATABASE_URL is not set. Create a Turso database for the prospect agent and add the URL to your environment.",
      );
    }
    _client = createClient({
      url,
      authToken: process.env.TURSO_PROSPECT_AUTH_TOKEN,
    });
  }
  return _client;
}

export const prospectDb = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = drizzle(getClient(), { schema });
    }
    return Reflect.get(_db, prop, receiver);
  },
});

export { schema as prospectSchema };
