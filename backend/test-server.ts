// Test-specific server setup that avoids ES module issues
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import morgan from "morgan";

// Express app setup
const app = express();

// Middleware
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Basic health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mock pool for testing
const pool = {
  query: async (sql: string, params?: any[]) => {
    // Mock database responses
    return { rows: [] };
  },
  connect: async () => ({
    query: async (sql: string, params?: any[]) => ({ rows: [] }),
    release: () => {},
  }),
  end: async () => {},
};

// Export for testing
export { app, pool };
