// Runs a .sql file against DATABASE_URL. Stands in for `psql`, which is not on
// PATH in a plain Node/Windows setup.
//
//   node scripts/db.mjs db/schema.sql
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const file = process.argv[2];

if (!file) {
  console.error("Usage: node scripts/db.mjs <path-to-sql-file>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

// node-postgres sends a whole script as one simple query, and Postgres wraps
// that in a single implicit transaction. Usually what we want — a failure
// rolls the file back.
//
// `ALTER TYPE ... ADD VALUE` is the exception. Postgres refuses to *use* a new
// enum label in the same transaction that added it, so the statement adding
// 'PENDING' and the exclusion constraint whose predicate names it cannot ship
// together. A `-- @separate` line on its own splits the file into chunks that
// each run as their own transaction, in order.
const chunks = readFileSync(file, "utf8")
  .split(/^--[ \t]*@separate[ \t]*$/m)
  .map((chunk) => chunk.trim())
  .filter(Boolean);

const client = new Client({ connectionString });

try {
  await client.connect();

  for (const chunk of chunks) {
    await client.query(chunk);
  }

  console.log(`Applied ${file}`);
} catch (error) {
  console.error(`Failed to apply ${file}:`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
