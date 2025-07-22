import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useAppStore } from "@/store/main";

// -------- Zod Types if needed (not strictly required here but ready-to-use) --------
interface LoginPayload {
  email: string;
  password: string;
}
interface LoginResponse {
  token: string;
  user_id: number;
  is_host: boolean;
  display_name: string;
  profile_photo_url: string;
  superhost_status: boolean;
}

// -- Error Boundary fallback
const ErrorFallback: React.FC<{ error: any }> = ({ error }) => (
  <div className="p-6 bg-red-50 border border-red-200 rounded">
    <h2 className="font-semibold text-lg text-red-700 mb-1">Something went wrong.</h2>
    <div className="text-sm text-red-600">
      {error?.message || "The page failed to load. Please try again."}
    </div>
  </div>
);

const UV_GuestLogin: React.FC = () => {
  // Zustand: Use set_user_session correctly per selector rule
  const set_user_session = useAppStore((state) => state.set_user_session);

  const navigate = useNavigate();
  // Local state
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error_message, setErrorMessage] = useState<string | null>(null);
  // Now: add required is_submitting state (sync to loginMutation.isLoading)
  const [is_submitting, setIsSubmitting] = useState<boolean>(false);

  // React-query mutation for login (v5 syntax)
  const loginMutation = useMutation({
    mutationFn: async (payload: LoginPayload): Promise<LoginResponse> => {
      setIsSubmitting(true);
      const apiUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const res = await axios.post<LoginResponse>(
        `${apiUrl}/auth/login`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return res.data;
    },
    onSuccess: (data: LoginResponse) => {
      set_user_session({
        user_id: data.user_id,
        is_authenticated: true,
        is_host: data.is_host,
        token: data.token,
        display_name: data.display_name,
        profile_photo_url: data.profile_photo_url,
        superhost_status: data.superhost_status,
        unread_message_count: 0,
        last_active_at: null,
      });
      // Clear form fields after success
      setEmail("");
      setPassword("");
      setIsSubmitting(false);
      navigate("/guest/dashboard", { replace: true });
    },
    onError: (error: any) => {
      if (
        error?.response?.data &&
        typeof error.response.data.error === "string"
      ) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage(
          "Unexpected error occurred. Please try again or check your network."
        );
      }
      setIsSubmitting(false);
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage("Please enter both your email and password.");
      return;
    }
    setIsSubmitting(true);
    loginMutation.mutate({ email: email.trim(), password });
  };

  // Keyboard Enter for input
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e as any);
    }
  };

  // New: handlers clear error on change
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setEmail(e.target.value);
  };
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setPassword(e.target.value);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(80vh)] py-10 px-3 bg-white">
      <div className="w-full max-w-md rounded-lg shadow-lg border border-gray-200 bg-white p-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-6 text-center">
          Welcome back
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={handleEmailChange}
              onKeyDown={handleInputKeyDown}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-base focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100"
              placeholder="you@example.com"
              required
              disabled={is_submitting || loginMutation.isPending}
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={handlePasswordChange}
              onKeyDown={handleInputKeyDown}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 text-base focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100"
              placeholder="Enter your password"
              required
              minLength={8}
              disabled={is_submitting || loginMutation.isPending}
            />
          </div>
          {error_message && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
              {error_message}
            </div>
          )}
          <button
            type="submit"
            disabled={is_submitting || loginMutation.isPending}
            className={`w-full py-2 px-4 rounded-md font-semibold shadow-sm transition-colors ${
              is_submitting || loginMutation.isPending
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
            } text-white text-base`}
          >
            {is_submitting || loginMutation.isPending ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
        <div className="flex flex-col items-center mt-6 space-y-2">
          <Link
            to="/guest/password-reset"
            className="text-sm text-blue-600 hover:underline focus:underline"
          >
            Forgot password?
          </Link>
          <div className="text-sm text-gray-500">
            New to BeachStay Villas?{" "}
            <Link
              to="/guest/signup"
              className="text-blue-600 hover:underline font-medium ml-1"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UV_GuestLogin;