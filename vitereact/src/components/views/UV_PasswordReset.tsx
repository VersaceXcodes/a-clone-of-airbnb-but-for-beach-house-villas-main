import React from "react";
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";

// --- Zod schemas for type safety
const PasswordResetRequestSchema = z.object({
  email: z.string().email().max(255),
});
type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

const PasswordResetSubmitSchema = z.object({
  reset_code: z.string().min(6).max(32),
  new_password: z.string().min(8).max(255),
});
type PasswordResetSubmit = z.infer<typeof PasswordResetSubmitSchema>;

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// --- Step enum type
type Step =
  | "request_email"
  | "confirm_email_sent"
  | "set_new_password"
  | "completed";

// --- View component
const UV_PasswordReset: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [step, set_step] = useState<Step>("request_email");
  const [email, set_email] = useState<string>("");
  const [reset_code, set_reset_code] = useState<string>("");
  const [new_password, set_new_password] = useState<string>("");
  const [error_message, set_error_message] = useState<string | null>(null);
  const [is_submitting, set_is_submitting] = useState<boolean>(false);
  // Track if reset_code came from URL to control input disabling logic
  const [hasUrlResetCode, set_hasUrlResetCode] = useState(false);

  // --- Detect reset_code in URL (on mount or param change)
  useEffect(() => {
    const code = searchParams.get("reset_code");
    if (code && typeof code === "string" && code.length >= 6) {
      set_reset_code(code.trim());
      set_step("set_new_password");
      set_error_message(null);
      set_hasUrlResetCode(true);
    } else {
      set_hasUrlResetCode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // --- Reset reset_code if user navigates back to request_email step
  useEffect(() => {
    if (step === "request_email") {
      set_reset_code("");
      set_new_password("");
      set_error_message(null);
      set_hasUrlResetCode(false);
    }
  }, [step]);

  const requestResetMutation = useMutation({
    mutationFn: async (variables: PasswordResetRequest) => {
      const parsed = PasswordResetRequestSchema.safeParse(variables);
      if (!parsed.success) {
        throw new Error("Please enter a valid email.");
      }
      const { data } = await axios.post<{ message: string }>(
        `${API_BASE_URL}/auth/password/request-reset`,
        { email: variables.email }
      );
      return data;
    },
    onMutate: () => {
      set_is_submitting(true);
      set_error_message(null);
    },
    onSuccess: () => {
      set_step("confirm_email_sent");
      set_is_submitting(false);
      set_error_message(null);
    },
    onError: (e: any) => {
      set_error_message(
        typeof e?.message === "string"
          ? e.message
          : "Could not process request, please try again."
      );
      set_is_submitting(false);
    },
  });

  const submitNewPasswordMutation = useMutation({
    mutationFn: async (variables: PasswordResetSubmit) => {
      const parsed = PasswordResetSubmitSchema.safeParse(variables);
      if (!parsed.success) {
        throw new Error(
          parsed.error.errors?.[0]?.message ||
            "Please enter a valid reset code and/or password."
        );
      }
      const { data } = await axios.post<{ message: string }>(
        `${API_BASE_URL}/auth/password/reset`,
        {
          reset_code: variables.reset_code,
          new_password: variables.new_password,
        }
      );
      return data;
    },
    onMutate: () => {
      set_is_submitting(true);
      set_error_message(null);
    },
    onSuccess: () => {
      set_step("completed");
      set_is_submitting(false);
      set_error_message(null);
    },
    onError: (e: any) => {
      let msg: string = "Could not reset password, please try again.";
      if (axios.isAxiosError(e) && e.response?.data?.error) {
        msg = e.response.data.error;
      } else if (typeof e?.message === "string") {
        msg = e.message;
      }
      set_error_message(msg);
      set_is_submitting(false);
    },
  });

  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (is_submitting) return;
    requestResetMutation.mutate({ email: email.trim() });
  };

  const handleSubmitNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (is_submitting) return;
    submitNewPasswordMutation.mutate({
      reset_code: reset_code.trim(),
      new_password: new_password,
    });
  };

  // Backend: 8-255 char, client requirements synced
  const passwordRules =
    "Password must be 8-255 characters. Avoid using your name, email, or repeat passwords.";

  useEffect(() => {
    set_error_message(null);
  }, [step, email, reset_code, new_password]);

  return (
    <>
      <div className="max-w-md mx-auto bg-white rounded-lg mt-12 shadow-lg px-6 py-8 flex flex-col items-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Password Reset</h1>

        {step === "request_email" && (
          <form
            onSubmit={handleRequestReset}
            className="w-full flex flex-col gap-4"
            aria-label="Request password reset email"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                id="email"
                name="email"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-violet-400 focus:ring focus:ring-violet-200 focus:ring-opacity-50"
                value={email}
                onChange={(e) => set_email(e.target.value)}
                required
                disabled={is_submitting}
                aria-required="true"
                aria-label="Email address"
              />
            </div>
            {error_message && (
              <div
                className="text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 text-sm"
                role="alert"
              >
                {error_message}
              </div>
            )}
            <button
              type="submit"
              className={`w-full py-2 px-4 rounded-md text-white font-semibold bg-violet-600 hover:bg-violet-700 transition flex items-center justify-center ${
                is_submitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
              disabled={is_submitting}
              aria-busy={is_submitting}
            >
              {is_submitting ? (
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4A4 4 0 108 16.9l-3.5 2.04C2.62 17.1 2.35 16.1 2.66 15.32 2.97 14.55 3.7 14 4.52 14h.98A6.98 6.98 0 014 12z"
                  ></path>
                </svg>
              ) : null}
              Send reset email
            </button>
            <div className="text-sm text-gray-500 mt-2 text-center">
              <Link
                className="text-violet-700 hover:underline font-medium"
                to="/guest/login"
              >
                Back to Login
              </Link>
            </div>
          </form>
        )}

        {step === "confirm_email_sent" && (
          <div className="w-full flex flex-col gap-6 items-center">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-14 h-14 text-violet-500 mb-2"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                viewBox="0 0 24 24"
              >
                <rect
                  width="18"
                  height="14"
                  x="3"
                  y="5"
                  rx="2"
                  fill="#e9e6fb"
                  stroke="currentColor"
                  strokeWidth={1.3}
                />
                <path
                  d="M3 5l9 7 9-7"
                  stroke="currentColor"
                  strokeWidth={1.3}
                  fill="none"
                />
              </svg>
              <div className="text-lg font-semibold text-violet-700">
                Check your email
              </div>
              <div className="text-gray-600 text-center text-sm">
                If your email exists in our records, a password reset email has been sent.
                <br />
                Please follow the link in the email to complete your reset.
              </div>
            </div>
            <div className="mt-1">
              <Link
                className="text-violet-600 hover:text-violet-900 underline"
                to="/guest/login"
              >
                Back to Login
              </Link>
            </div>
          </div>
        )}

        {step === "set_new_password" && (
          <form
            onSubmit={handleSubmitNewPassword}
            className="w-full flex flex-col gap-4"
            aria-label="Set a new password"
          >
            <div>
              <label
                htmlFor="reset_code"
                className="block text-sm font-medium text-gray-700"
              >
                Reset Code
              </label>
              <input
                type="text"
                id="reset_code"
                name="reset_code"
                pattern=".{6,32}"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-violet-400 focus:ring focus:ring-violet-200 focus:ring-opacity-50"
                value={reset_code}
                onChange={(e) => set_reset_code(e.target.value.trim())}
                required
                aria-required="true"
                aria-label="Password reset code"
                disabled={hasUrlResetCode}
              />
            </div>
            <div>
              <label
                htmlFor="new_password"
                className="block text-sm font-medium text-gray-700"
              >
                New Password (8-255 characters)
              </label>
              <input
                type="password"
                id="new_password"
                name="new_password"
                autoComplete="new-password"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-violet-400 focus:ring focus:ring-violet-200 focus:ring-opacity-50"
                value={new_password}
                onChange={(e) => set_new_password(e.target.value)}
                minLength={8}
                maxLength={255}
                required
                aria-required="true"
                aria-label="New password"
              />
              <div className="text-xs text-gray-500 mt-1">{passwordRules}</div>
            </div>
            {error_message && (
              <div
                className="text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 text-sm"
                role="alert"
              >
                {error_message}
              </div>
            )}
            <button
              type="submit"
              className={`w-full py-2 px-4 rounded-md text-white font-semibold bg-violet-600 hover:bg-violet-700 transition flex items-center justify-center ${
                is_submitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
              disabled={
                is_submitting ||
                !reset_code ||
                !new_password ||
                new_password.length < 8
              }
              aria-busy={is_submitting}
            >
              {is_submitting ? (
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4A4 4 0 108 16.9l-3.5 2.04C2.62 17.1 2.35 16.1 2.66 15.32 2.97 14.55 3.7 14 4.52 14h.98A6.98 6.98 0 014 12z"
                  ></path>
                </svg>
              ) : null}
              Set New Password
            </button>
            <div className="text-sm text-gray-500 mt-2 text-center">
              <Link
                className="text-violet-700 hover:underline font-medium"
                to="/guest/login"
              >
                Back to Login
              </Link>
            </div>
          </form>
        )}

        {step === "completed" && (
          <div className="w-full flex flex-col gap-6 items-center">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-16 h-16 text-green-500 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="10" fill="#e4fae2" />
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12.5l2.5 2.5L16 9"
                />
              </svg>
              <div className="text-lg font-semibold text-green-700">
                Password reset successful!
              </div>
              <div className="text-gray-600 text-center text-sm">
                You may now log in with your new password.
              </div>
            </div>
            <Link
              className="w-full py-2 px-4 rounded-md text-white font-semibold bg-violet-600 hover:bg-violet-700 transition text-center"
              to="/guest/login"
            >
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_PasswordReset;