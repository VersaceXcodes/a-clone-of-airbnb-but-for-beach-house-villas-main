import React, { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAppStore } from "@/store/main";
import { z } from "zod";

// Import zod types for full type safety
import {
  bookingSchema,
  villaSchema,
  userSchema,
  type Booking,
  type Villa,
  type User,
} from "@schema";

// Adjusted to match backend API (villa_id is number, main_photo_url is string)
type VillaSummary = {
  villa_id: number;
  title: string;
  address_city: string;
  main_photo_url: string;
  price_per_night: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  is_active: boolean;
  is_instant_book: boolean;
  avg_rating: number;
  reviews_count: number;
};

// Helper: Parse and validate API data using zod
function safeParseZod<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

// API Base URL utility
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// ===========================
// API FETCHERS (REACT QUERY)
// ===========================

/**
 * 1) Fetch booking by booking_id
 */
const fetchBooking = async ({
  booking_id,
  token,
}: {
  booking_id: string;
  token: string;
}): Promise<Booking> => {
  const { data } = await axios.get(
    `${API_BASE}/bookings/${encodeURIComponent(booking_id)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const parsed = safeParseZod(bookingSchema, data);
  if (!parsed) throw new Error("Malformed booking data");
  return parsed;
};

/**
 * 2) Fetch villa by villa_id
 */
const fetchVilla = async ({
  villa_id,
}: {
  villa_id: string;
}): Promise<Villa> => {
  const { data } = await axios.get(
    `${API_BASE}/villa/${encodeURIComponent(villa_id)}`
  );
  const parsed = safeParseZod(villaSchema, data);
  if (!parsed) throw new Error("Malformed villa data");
  return parsed;
};

/**
 * 3) Fetch current user profile
 */
const fetchCurrentUserProfile = async ({
  token,
}: {
  token: string;
}): Promise<User> => {
  const { data } = await axios.get(`${API_BASE}/account/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const parsed = safeParseZod(userSchema, data);
  if (!parsed) throw new Error("Malformed user data");
  return parsed;
};

/**
 * 4) Fetch recommendations: Villas in same city, active, page=1
 */
const fetchRecommendations = async ({
  city,
  own_villa_id,
}: {
  city: string;
  own_villa_id: string | number;
}): Promise<VillaSummary[]> => {
  const { data } = await axios.get(
    `${API_BASE}/villas?location=${encodeURIComponent(city)}&is_active=true&page=1`
  );
  // Backend always returns array of VillaSummary (villa_id:number, main_photo_url:string)
  const results = Array.isArray(data.results) ? data.results : [];
  // Filter out current villa
  return results.filter((v: VillaSummary) => String(v.villa_id) !== String(own_villa_id));
};

// =========================
// Main Component
// =========================

const UV_BookingConfirmation: React.FC = () => {
  const params = useParams();
  const booking_id = params.booking_id || params.bookingId || "";
  const navigate = useNavigate();
  const token = useAppStore((s) => s.user_session.token);
  const is_authenticated = useAppStore((s) => s.user_session.is_authenticated);
  const current_user_id = useAppStore((s) => s.user_session.user_id);

  React.useEffect(() => {
    if (!is_authenticated) {
      navigate("/guest/login", { replace: true });
    }
  }, [is_authenticated, navigate]);

  // --- 1. Booking Query ----
  const {
    data: booking,
    isLoading: loadingBooking,
    isError: isBookingError,
    error: bookingError,
  } = useQuery<Booking, Error>({
    queryKey: ["booking", booking_id, token],
    queryFn: () => {
      if (!booking_id || !token)
        throw new Error("Missing booking_id or token");
      return fetchBooking({ booking_id, token });
    },
    enabled: !!booking_id && !!token,
    retry: false,
  });

  // --- 2. Villa Query ---
  const villa_id = booking?.villa_id || "";
  const {
    data: villa,
    isLoading: loadingVilla,
    isError: isVillaError,
    error: villaError,
  } = useQuery<Villa, Error>({
    queryKey: ["villa", villa_id],
    queryFn: () => {
      if (!villa_id) throw new Error("Missing villa_id");
      return fetchVilla({ villa_id: String(villa_id) });
    },
    enabled: !!villa_id,
    retry: false,
  });

  // --- 3. Host Profile Logic ---
  // If current user is host of this villa, get host profile (self), else: generic fallback
  const shouldFetchHostProfile =
    !!booking && String(booking.host_user_id) === String(current_user_id) && !!token;
  const {
    data: hostProfile,
    isLoading: loadingHost,
    isError: isHostError,
    error: hostError,
  } = useQuery<User, Error>({
    queryKey: ["host-profile", booking?.host_user_id, token],
    queryFn: () => {
      if (!token) throw new Error("Missing token");
      return fetchCurrentUserProfile({ token });
    },
    enabled: shouldFetchHostProfile,
    retry: false,
  });

  // --- 4. Recommendations ---
  const address_city = villa?.address_city || "";
  const {
    data: recommendations,
    isLoading: loadingRec,
    isError: isRecError,
    error: recError,
  } = useQuery<VillaSummary[], Error>({
    queryKey: ["recommendations", address_city, villa_id, "booking-confirmation"],
    queryFn: () => {
      if (!address_city || !villa_id) return [];
      return fetchRecommendations({ city: address_city, own_villa_id: villa_id });
    },
    enabled: !!address_city && !!villa_id,
    retry: false,
  });

  // =============================
  // Error boundaries
  // =============================
  let criticalError: string | null = null;
  if (!booking_id) {
    criticalError = "Missing booking confirmation identifier.";
  } else if (isBookingError) {
    criticalError = "Could not load your booking confirmation. Please check your reservation link or contact support.";
  } else if (isVillaError) {
    criticalError = "Could not load villa details. Please try again later.";
  }

  // Helper: Format dates
  const fmtDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  // Host Display Logic + Fallback if not available
  const host_display = useMemo(() => {
    if (hostProfile) {
      return {
        display_name: hostProfile.display_name || "Your Host",
        profile_photo_url:
          hostProfile.profile_photo_url || "https://picsum.photos/seed/host/56",
        is_superhost: !!(hostProfile.is_superhost ?? hostProfile.superhost_status),
        fallback: false,
      };
    } else if (villa && villa.owner_user_id) {
      // Fallback: we don't have host profile for this host
      return {
        display_name: "Host (not available)",
        profile_photo_url: "https://picsum.photos/seed/host/56",
        is_superhost: false,
        fallback: true,
      };
    } else {
      return null;
    }
  }, [hostProfile, villa]);

  // =============================
  // Render
  // =============================

  return (
    <>
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-8">
        {/* Error boundary */}
        {criticalError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center shadow mt-12">
            <div className="text-2xl font-bold mb-2 text-red-800">
              Confirmation Unavailable
            </div>
            <div className="text-red-700 my-4">{criticalError}</div>
            <Link
              to="/"
              className="inline-block bg-sky-600 text-white rounded-md px-5 py-2 mt-6 hover:bg-sky-700 font-semibold transition"
            >
              Go Home
            </Link>
          </div>
        ) : loadingBooking || loadingVilla ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-sky-400 border-t-transparent" aria-label="Loading"></div>
          </div>
        ) : booking && villa ? (
          <>
            {/* Header: celebration */}
            <div className="text-center pt-4 pb-8">
              <div className="text-3xl font-extrabold text-sky-700 mb-2">
                🎉 Booking Confirmed!
              </div>
              <div className="text-lg text-gray-700">
                {booking.status === "confirmed"
                  ? "Your stay is confirmed and a confirmation email has been sent."
                  : booking.status === "pending"
                  ? "Your booking request is pending. We'll notify you as soon as it's confirmed."
                  : "Your reservation status: " + booking.status}
              </div>
              <div className="text-sm text-sky-900 mt-2">
                Reservation reference:{" "}
                <span className="font-mono font-semibold bg-gray-100 px-2 py-0.5 rounded">
                  {booking.booking_id}
                </span>
              </div>
            </div>

            {/* Confirmation Card */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-lg mx-auto max-w-2xl flex flex-col md:flex-row overflow-hidden">
              {villa.main_photo_url && (
                <img
                  src={villa.main_photo_url}
                  alt={villa.title}
                  className="w-full md:w-64 h-56 object-cover object-center md:rounded-l-xl"
                  loading="lazy"
                />
              )}
              <div className="flex-1 p-6 flex flex-col justify-between">
                <div>
                  {/* Villa title and city */}
                  <div className="text-xl font-bold text-gray-900">
                    {villa.title}
                  </div>
                  <div className="text-gray-600 font-medium mb-2">
                    {villa.address_city}, {villa.address_country}
                  </div>
                  {/* Dates and Guests */}
                  <div className="flex flex-wrap space-x-6 text-gray-700 mb-1 mt-2">
                    <span>
                      <span className="font-semibold">Check-in:</span>{" "}
                      {fmtDate(booking.checkin_date)}
                    </span>
                    <span>
                      <span className="font-semibold">Check-out:</span>{" "}
                      {fmtDate(booking.checkout_date)}
                    </span>
                  </div>
                  <div className="text-gray-700 mb-2">
                    <span className="font-semibold">Guests:</span>{" "}
                    {booking.num_guests}
                  </div>
                  {/* Price Summary */}
                  <div className="mt-2 text-gray-900 text-base">
                    <span className="font-semibold">Total Paid:</span>{" "}
                    <span className="font-mono text-lg tracking-tight">
                      ${booking.total_price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
                <div>
                  {/* Host Profile */}
                  {host_display && (
                    <div className="flex items-center mt-4 border-t pt-3">
                      <img
                        src={host_display.profile_photo_url}
                        alt={host_display.display_name}
                        className="w-12 h-12 rounded-full object-cover border border-gray-200"
                        loading="lazy"
                      />
                      <div className="ml-3">
                        <span className="font-semibold text-gray-800 block">
                          Host: {host_display.display_name}
                        </span>
                        {host_display.is_superhost && !host_display.fallback && (
                          <span className="inline-block text-xs bg-yellow-100 text-yellow-700 font-semibold rounded px-2 py-0.5 mt-1">
                            ⭐ Superhost
                          </span>
                        )}
                        {host_display.fallback && (
                          <span className="inline-block text-xs bg-neutral-100 text-neutral-600 rounded px-2 py-0.5 mt-1" title="Host details unavailable due to privacy settings or booking status.">
                            Host details unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="text-center mt-8">
              <Link
                to="/guest/my-trips"
                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-semibold shadow transition"
              >
                View My Trips
              </Link>
            </div>

            {/* Recommendations */}
            <div className="mt-14">
              <div className="text-lg font-bold text-sky-800 mb-4 text-center">
                You might also like
              </div>
              {loadingRec ? (
                <div className="flex items-center justify-center min-h-[120px]">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-300 border-t-transparent" aria-label="Loading"></div>
                </div>
              ) : recommendations && recommendations.length > 0 ? (
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {recommendations.slice(0, 6).map((rec) => (
                    <Link
                      to={`/villa/${rec.villa_id}`}
                      key={rec.villa_id}
                      className="bg-white border border-gray-200 rounded-xl shadow hover:shadow-lg transition p-2 flex flex-col"
                    >
                      <img
                        src={
                          rec.main_photo_url ||
                          `https://picsum.photos/seed/villa${rec.villa_id}/320/180`
                        }
                        alt={rec.title}
                        className="h-36 w-full object-cover rounded-t-xl mb-2"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 truncate">
                          {rec.title}
                        </div>
                        <div className="text-xs text-gray-600">
                          {rec.address_city}
                        </div>
                        <div className="text-sm text-gray-700 mt-1">
                          ${rec.price_per_night.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}{" "}
                          / night
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {rec.bedrooms} bd · {rec.beds} beds · {rec.bathrooms} ba
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-1">
                          <span className="text-yellow-500" aria-label="Rating Star">
                            ★
                          </span>
                          <span className="text-gray-700 text-xs">
                            {Number(rec.avg_rating).toFixed(2)}
                          </span>
                        </div>
                        {rec.is_instant_book && (
                          <span className="bg-green-100 text-green-700 rounded px-2 py-0.5 text-xs font-medium">
                            Instant book
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-gray-600 text-center p-8">
                  No other villas found in {address_city}. Try browsing in{" "}
                  <Link to="/search" className="text-sky-600 underline">
                    search
                  </Link>
                  .
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-gray-500">Loading confirmation...</div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_BookingConfirmation;