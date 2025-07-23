const request = require("supertest");

// Set test environment
process.env.NODE_ENV = "test";

let app: any;
let pool: any;

// Helper: Import test server
beforeAll(async () => {
  // Use test-specific server to avoid ES module issues
  const serverModule = await import("./test-server");
  app = serverModule.app;
  pool = serverModule.pool;
});

afterAll(async () => {
  // Clean up if needed
  if (pool && pool.close) {
    await pool.close();
  }
});

// ==== BASIC TESTS ====

describe("Server Setup", () => {
  test("Server app is available", () => {
    expect(app).toBeDefined();
  });

  test("Health check works", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("Basic API Tests", () => {
  test("404 for non-existent endpoint", async () => {
    const res = await request(app).get("/non-existent-endpoint");
    expect(res.status).toBe(404);
  });
});
