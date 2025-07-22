import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppStore } from "@/store/main";

// Parse query param straightforwardly from location.search (React Router v6+)
function useQueryParam(param: string): string | null {
  const { search } = useLocation();
  return React.useMemo(() => {
    if (!search) return null;
    const params = new URLSearchParams(search);
    const value = params.get(param);
    if (typeof value === "string") return value;
    return null;
  }, [search, param]);
}

// Contextually pick severity from reason
function getErrorSeverity(reason: string | null): "error" | "warning" | "info" {
  if (!reason) return "error";
  const r = reason.toLowerCase();
  if (
    r.includes("overlap") ||
    r.includes("unavailable") ||
    r.includes("double") ||
    r.includes("already") ||
    r.includes("not available")
  )
    return "warning";
  if (
    r.includes("technical") ||
    r.includes("server") ||
    r.includes("error") ||
    r.includes("failure")
  )
    return "error";
  // Payment issues could arguably be error, but we choose info for more reassurance
  if (
    r.includes("payment") ||
    r.includes("card") ||
    r.includes("declined") ||
    r.includes("invalid")
  )
    return "info";
  return "error";
}

// Format a user-friendly message from reason or fallback
function getErrorMessage(reason: string | null): string {
  if (!reason || !reason.trim()) {
    return "Sorry, we couldn't complete your booking. Please try again, check your details, or contact support if the issue persists.";
  }
  // Try to beautify reason for customer
  if (reason.toLowerCase().match(/overlap|already booked|double|not available|unavailable/))
    return "The selected dates for your villa are no longer available. Please choose new dates or review your booking.";
  if (reason.toLowerCase().match(/payment|invalid.*card|declined|charge failed|insufficient/))
    return "There was a problem processing your payment. Please check your card details or try another method.";
  if (reason.toLowerCase().match(/technical|server|error/))
    return "A technical error occurred during your booking. Please try again, or contact support if this continues.";
  // Default: just sanitize and display
  return reason;
}

// Helper to build search query string from state
function buildSearchQueryString(search_state: any): string {
  if (!search_state) return "";
  const params: Record<string, string> = {};
  if (search_state.location) params.location = search_state.location;
  if (search_state.checkin_date) params.checkin_date = search_state.checkin_date;
  if (search_state.checkout_date) params.checkout_date = search_state.checkout_date;
  // FIX: Include num_guests for all >= 1
  if (
    typeof search_state.num_guests === "number" &&
    !isNaN(search_state.num_guests) &&
    search_state.num_guests >= 1
  ) {
    params.num_guests = String(search_state.num_guests);
  }
  const f = search_state.filters || {};
  if (f.price_min != null) params.price_min = String(f.price_min);
  if (f.price_max != null) params.price_max = String(f.price_max);
  if (f.bedrooms != null) params.bedrooms = String(f.bedrooms);
  if (f.beds != null) params.beds = String(f.beds);
  if (f.bathrooms != null) params.bathrooms = String(f.bathrooms);
  if (Array.isArray(f.amenities) && f.amenities.length)
    params.amenities = f.amenities.join(",");
  if (f.is_beachfront != null) params.is_beachfront = String(!!f.is_beachfront);
  if (f.is_pet_friendly != null) params.is_pet_friendly = String(!!f.is_pet_friendly);
  if (f.is_instant_book != null) params.is_instant_book = String(!!f.is_instant_book);
  if (search_state.sort) params.sort = search_state.sort;
  if (search_state.page && search_state.page > 1) params.page = String(search_state.page);
  const qs = new URLSearchParams(params).toString();
  return qs ? "?" + qs : "";
}

const UV_BookingFailure: React.FC = () => {
  // Get error reason from query param
  const reason = useQueryParam("reason");

  // Access global state
  const villa_id = useAppStore((state) => state.booking_cart.villa_id);
  const search_state = useAppStore((state) => state.search_state);

  // Error display logic
  const error_severity = getErrorSeverity(reason);
  const error_message = getErrorMessage(reason);

  // For 'Back to Villa' link if available
  const has_villa = typeof villa_id === "number" && !isNaN(villa_id);

  // For 'Back to Search' button
  const search_query = buildSearchQueryString(search_state);

  // Error coloring context (severity): Tailwind mapping
  const severity_classes: Record<string, string> = {
    error: "bg-red-50 border-red-400 text-red-700",
    warning: "bg-yellow-50 border-yellow-400 text-yellow-800",
    info: "bg-blue-50 border-blue-400 text-blue-700",
  };

  // Icon mapping for visual emphasis
  const icon_svg: Record<string, JSX.Element> = {
    error: (
      <svg className="h-6 w-6 text-red-500 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 11 3 12a9 9 0 0118 0z" /></svg>
    ),
    warning: (
      <svg className="h-6 w-6 text-yellow-500 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 17a5 5 0 100-10 5 5 0 000 10z" /></svg>
    ),
    info: (
      <svg className="h-6 w-6 text-blue-500 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20.5A8.5 8.5 0 104 12.5a8.5 8.5 0 0016.5 8z" /></svg>
    ),
  };

  // Support email (could be in config but per instructions, static for now)
  const support_email = "support@beachstayvillas.com";
  const mailto_support = `mailto:${support_email}?subject=Booking%20Assistance`;

  // Reset scroll to top on mount
  React.useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <div className="max-w-2xl mx-auto px-6 py-16 flex flex-col items-center justify-center min-h-[60vh]">
        {/* Error Message Box */}
        <div 
          className={`w-full flex items-center border-l-4 rounded-md px-4 py-5 mb-6 shadow-sm ${severity_classes[error_severity]}`}
          role="alert"
          aria-live="assertive"
          data-testid="booking-failure-alert"
        >
          <div>{icon_svg[error_severity]}</div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold mb-1">Booking Failed</h1>
            <p className="text-base">{error_message}</p>
          </div>
        </div>

        {/* Explanation and Actions */}
        <div className="w-full text-center mb-6">
          <p className="text-gray-600 mb-2">
            Your reservation could not be completed. 
            {has_villa
              ? " You may retry booking, review the villa details, or search for other properties."
              : " Please return to the search results to try again or contact support."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mb-8">
          {has_villa && (
            <Link
              to={`/villa/${villa_id}`}
              className="inline-flex items-center justify-center px-6 py-2 rounded-md bg-sky-600 text-white font-semibold hover:bg-sky-700 transition focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              data-testid="back-to-villa-btn"
            >
              &larr; Back to Villa
            </Link>
          )}
          <Link
            to={`/search${search_query}`}
            className="inline-flex items-center justify-center px-6 py-2 rounded-md bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 transition focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            data-testid="back-to-search-btn"
          >
            &larr; Back to Search
          </Link>
          <a
            href={mailto_support}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-2 rounded-md bg-white border border-sky-400 text-sky-800 font-semibold hover:bg-sky-50 transition focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
            data-testid="contact-support-link"
          >
            <svg className="h-5 w-5 text-sky-400 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-17 8h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
            Contact Support
          </a>
        </div>

        {/* Encouragement */}
        <div className="w-full text-center mt-2">
          <p className="text-sm text-gray-500">
            If the problem persists, please reach out to our support team for assistance.
          </p>
        </div>
      </div>
    </>
  );
};

export default UV_BookingFailure;