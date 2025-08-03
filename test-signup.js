#!/usr/bin/env node

const axios = require("axios");

async function testSignup() {
  const baseURL = "https://123testing-project-yes.launchpulse.ai/api";

  console.log("Testing signup flow...\n");

  // Test 1: Health check
  try {
    console.log("1. Testing health endpoint...");
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log("✅ Health check passed:", healthResponse.data);
  } catch (error) {
    console.log("❌ Health check failed:", error.message);
    return;
  }

  // Test 2: Valid signup
  try {
    console.log("\n2. Testing valid signup...");
    const signupData = {
      email: `test${Date.now()}@example.com`,
      password: "testpassword123",
      display_name: "Test User",
    };

    const signupResponse = await axios.post(
      `${baseURL}/auth/signup`,
      signupData,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      },
    );

    console.log("✅ Signup successful:", {
      user_id: signupResponse.data.user_id,
      display_name: signupResponse.data.display_name,
      is_host: signupResponse.data.is_host,
      token_length: signupResponse.data.token.length,
    });

    // Test 3: Duplicate email
    try {
      console.log("\n3. Testing duplicate email...");
      await axios.post(`${baseURL}/auth/signup`, signupData);
      console.log("❌ Duplicate email should have failed");
    } catch (error) {
      if (
        error.response?.status === 400 &&
        error.response?.data?.error === "Email already registered"
      ) {
        console.log("✅ Duplicate email properly rejected");
      } else {
        console.log(
          "❌ Unexpected error for duplicate email:",
          error.response?.data || error.message,
        );
      }
    }
  } catch (error) {
    console.log("❌ Signup failed:", error.response?.data || error.message);
  }

  // Test 4: Invalid data
  try {
    console.log("\n4. Testing invalid data...");
    await axios.post(`${baseURL}/auth/signup`, {
      email: "invalid-email",
      password: "123",
      display_name: "",
    });
    console.log("❌ Invalid data should have failed");
  } catch (error) {
    if (error.response?.status === 400) {
      console.log(
        "✅ Invalid data properly rejected:",
        error.response.data.error,
      );
    } else {
      console.log(
        "❌ Unexpected error for invalid data:",
        error.response?.data || error.message,
      );
    }
  }

  console.log("\n✅ All tests completed!");
}

testSignup().catch(console.error);
