import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// DATE columns are calendar days, not instants. Left alone, node-postgres
// turns them into Dates in the server's local zone, which shifts a booking
// by one day for anyone west of Greenwich. Hand them over as the
// YYYY-MM-DD strings the rest of the app speaks.
types.setTypeParser(1082, (value) => value);

// TIMESTAMP has the same problem one level down. These are written by now(),
// so they are instants in the database's zone, but they carry no offset and
// node-postgres reads them in the Node server's zone. Appending the offset
// that is really there is the whole fix.
types.setTypeParser(1114, (value) => new Date(`${value}Z`));

// NUMERIC already arrives as a string, and that is deliberate: parsing pesos
// into a float reintroduces rounding error. Do not add a parser for it.

const connectionString = process.env.DATABASE_URL ?? '';

const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
  max: 5,
});
