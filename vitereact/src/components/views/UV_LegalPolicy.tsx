import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// ========================
// Types
// ========================
interface PolicyContent {
  content: string;
}

// ========================
// Data Fetching Function
// ========================
const fetchPolicyContent = async (policySlug: string): Promise<PolicyContent> => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const resp = await axios.get<{ content: string }>(
    `${baseUrl}/info/${encodeURIComponent(policySlug)}`
  );
  // Defensive: ensure response has `content`
  if (!resp.data || typeof resp.data.content !== "string") {
    throw new Error("Malformed response from server.");
  }
  return resp.data;
};

const DEFAULT_TITLE_MAP: Record<string, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  about: "About Us",
  contact: "Contact Us",
};

const DEFAULT_CONTACT_EMAIL = "support@beachstay.villas"; // fallback if backend doesn't include it

// ========================
// Main Component
// ========================
const UV_LegalPolicy: React.FC = () => {
  const { policy_slug } = useParams<{ policy_slug?: string }>(); // Router passes 'policy_slug' param
  const currentPolicySlug = policy_slug || "privacy";

  // Query for legal policy content
  const {
    data,
    isLoading,
    error,
    isError,
    refetch,
  } = useQuery<PolicyContent, Error>({
    queryKey: ["legal_policy", currentPolicySlug],
    queryFn: () => fetchPolicyContent(currentPolicySlug),
    // Important: refetch on param change by default
    retry: false,
    staleTime: 1000 * 60 * 10, // 10 mins cache since legal rarely changes
  });

  // UI helpers
  const policyTitle =
    (currentPolicySlug && DEFAULT_TITLE_MAP[currentPolicySlug.toLowerCase()]) ||
    (currentPolicySlug
      ? currentPolicySlug.charAt(0).toUpperCase() + currentPolicySlug.slice(1)
      : "Policy");

  // Render starts
  return (
    <>
      <div className="w-full min-h-screen flex flex-col items-center bg-gray-50 pb-16 pt-10">
        <div className="w-full max-w-2xl shadow-lg rounded-lg bg-white p-6 sm:p-10 mt-6 mb-6 border border-gray-100 flex flex-col">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-6 text-center">
            {policyTitle}
          </h1>

          {/* Loading State */}
          {isLoading && (
            <div
              className="flex flex-col items-center justify-center py-10"
              aria-live="polite"
            >
              <svg
                className="animate-spin h-10 w-10 text-blue-500 mb-3"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={4}></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              <div className="text-gray-600 font-medium">Loading...</div>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div
              className="flex flex-col items-center text-center text-red-600 gap-2 py-10"
              aria-live="assertive"
            >
              <span className="text-lg font-semibold">
                {error?.message?.match(/404|not found/i)
                  ? "Policy Not Found"
                  : "Unable to load this policy."}
              </span>
              <div className="text-gray-700">
                {error?.message || "An error occurred while loading the page."}
              </div>
              <button
                className="mt-4 px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white font-medium transition"
                onClick={() => refetch()}
              >
                Retry
              </button>
              <Link
                to="/"
                className="mt-3 text-blue-700 hover:underline font-medium focus:outline-none"
              >
                Back to Home
              </Link>
            </div>
          )}

          {/* Success State: Rendered Policy Content */}
          {!isLoading && !isError && data && (
            <div className="prose prose-gray max-w-none text-gray-800 policy-content">
              {/* Safe: only for trusted, static content from backend */}
              <div
                dangerouslySetInnerHTML={{
                  __html: data.content,
                }}
                aria-label={`${policyTitle} Content`}
              />
            </div>
          )}

          {/* Contact section (for 'contact' or if policy includes contact info in content) */}
          {!isLoading && !isError && currentPolicySlug.toLowerCase() === "contact" && (
            <div className="mt-8 flex flex-col items-center border-t pt-8">
              <span className="block text-base text-gray-700 mb-2">
                For urgent support or inquiries:
              </span>
              <a
                href={`mailto:${DEFAULT_CONTACT_EMAIL}`}
                className="inline-block text-blue-600 hover:underline font-semibold text-lg"
              >
                {DEFAULT_CONTACT_EMAIL}
              </a>
            </div>
          )}

          {/* Back link for all policies */}
          {!isError && (
            <div className="mt-12 flex justify-center">
              <Link
                to="/"
                className="text-blue-500 hover:underline font-medium flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5 mr-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_LegalPolicy;