import React from "react";
import { Link, useSearchParams } from "react-router-dom";

/**
 * UV_ErrorState - Generic error/empty state fallback.
 * - Displays a user-friendly message, default or from ?message=
 * - Offers "Go to homepage" and "Contact support" CTAs
 * - No backend API calls or global store usage required.
 */
const UV_ErrorState: React.FC = () => {
  // Support contact link
  const support_contact_url = "mailto:support@beachstay.villas";
  const can_navigate_home = true;

  // Read error message from URL search param (?message=...)
  const [searchParams] = useSearchParams();
  const messageParam = searchParams.get("message");

  // Ensure the message is always treated as plain text to prevent XSS
  const escape = (str: string): string => str.replace(/[&<>'\"\\]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[c] || c));

  // Sanitize and display the error message if present, else default.
  const error_message =
    typeof messageParam === "string" && messageParam.trim().length > 0
      ? escape(messageParam)
      : "Something went wrong.";

  return (
    <>
      <div className="min-h-[60vh] flex flex-col justify-center items-center px-5 py-12 bg-white">
        {/* Big friendly icon */}
        <span
          role="img"
          aria-label="Error"
          className="mb-4 scale-125 animate-bounce"
          style={{ fontSize: '4rem' }}
        >
          {/* SVG Warning Icon for fully supported visuals */}
          <svg
            className="w-16 h-16 text-red-400"
            fill="none"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
            <circle cx="32" cy="32" r="30" fill="#FEF2F2" stroke="#F87171" strokeWidth="4"/>
            <path d="M32 18 v18" stroke="#F87171" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="32" cy="46" r="2.5" fill="#F87171"/>
          </svg>
        </span>

        {/* Headline */}
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Oops! An error occurred
        </h1>
        {/* Message (from URL or default, always rendered as plain text) */}
        <div className="text-gray-600 mb-6 text-lg text-center max-w-lg">
          {error_message}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {can_navigate_home && (
            <Link
              to="/"
              className="inline-block px-5 py-2 rounded-full font-semibold bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            >
              Go to homepage
            </Link>
          )}

          <a
            href={support_contact_url}
            className="inline-block px-5 py-2 rounded-full font-semibold bg-gray-100 text-blue-700 hover:bg-blue-200 border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
            rel="noopener noreferrer"
          >
            Contact support
          </a>
        </div>
        {/* Optional: back (browser) button */}
        <button
          type="button"
          className="text-sm text-gray-500 underline hover:text-blue-500 mt-2"
          onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign('/')}
          aria-label="Go back to previous page"
        >
          Try previous page
        </button>
      </div>
    </>
  );
};

export default UV_ErrorState;