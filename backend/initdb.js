import dotenv from "dotenv";
import fs from "fs";
import pg from "pg";
const { Pool } = pg;

dotenv.config();

const {
  DATABASE_URL,
  PGHOST,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  PGPORT = 5432,
} = process.env;

const pool = new Pool(
  DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: { require: true },
      }
    : {
        host:
          PGHOST || "ep-ancient-dream-abbsot9k-pooler.eu-west-2.aws.neon.tech",
        database: PGDATABASE || "neondb",
        user: PGUSER || "neondb_owner",
        password: PGPASSWORD || "npg_jAS3aITLC5DX",
        port: Number(PGPORT),
        ssl: { require: true },
      },
);

async function initDb() {
  const client = await pool.connect();
  try {
    // Read and split SQL commands
    const dbInitCommands = fs
      .readFileSync(`./db.sql`, "utf-8")
      .toString()
      .split(/(?=CREATE TABLE |INSERT INTO)/);

    // Execute each command individually (no transaction to avoid rollback on duplicate keys)
    for (let cmd of dbInitCommands) {
      if (cmd.trim()) {
        console.dir({ "backend:db:init:command": cmd });
        try {
          await client.query(cmd);
        } catch (error) {
          // Skip duplicate key errors for INSERT statements
          if (error.code === "23505" && cmd.trim().startsWith("INSERT")) {
            console.log("Skipping duplicate insert:", error.message);
            continue;
          }
          // Skip table already exists errors
          if (error.code === "42P07" && cmd.trim().startsWith("CREATE TABLE")) {
            console.log("Table already exists, skipping:", error.message);
            continue;
          }
          throw error;
        }
      }
    }

    console.log("Database initialization completed successfully");
  } catch (e) {
    console.error("Database initialization failed:", e);
    throw e;
  } finally {
    // Release client back to pool
    client.release();
  }
}

// Execute initialization
initDb().catch(console.error);
