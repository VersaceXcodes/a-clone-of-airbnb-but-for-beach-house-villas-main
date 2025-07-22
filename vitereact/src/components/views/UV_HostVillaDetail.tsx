import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";

// Zod types (must be available at @schema alias)
import type {
  Villa,
  VillaPhoto,
  VillaCalendarDay,
  VillaPricingOverride,
  Booking,
  UserReview,
} from "@schema";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Helpers
function formatDate(date: string | Date) {
  // YYYY-MM-DD for input/calendar, human MM/DD/YYYY for display
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  requested: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-gray-100 text-gray-700",
  modified: "bg-blue-100 text-blue-700",
};

export const UV_HostVillaDetail: React.FC = () => {
  const params = useParams<{ villaId: string }>();
  // Parse villaId (from slug) to number for API usage
  const villaId = params.villaId ? parseInt(params.villaId, 10) : undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Auth State (Zustand) ---
  const user_id = useAppStore((s) => s.user_session.user_id);
  const is_host = useAppStore((s) => s.user_session.is_host);
  const token = useAppStore((s) => s.user_session.token);

  // --- Fetch Villa Details ---
  const {
    data: villa,
    isLoading: villaLoading,
    error: villaError,
  } = useQuery<Villa, Error>({
    queryKey: ["villaDetail", villaId],
    enabled: !!villaId && !!token,
    queryFn: async () => {
      const { data } = await axios.get<Villa>(`${API_BASE_URL}/villa/${villaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });

  // --- Ownership Check: Only owner can view ---
  React.useEffect(() => {
    if (!villaLoading && villa && typeof user_id === "number" && villa.owner_user_id !== user_id) {
      // Not the owner of the villa
      navigate("/error", {
        state: { message: "Not authorized to view this villa." },
        replace: true,
      });
    }
  }, [villaLoading, villa, user_id, navigate]);

  // --- Fetch Villa Photos ---
  const {
    data: villa_photos = [],
    isLoading: photosLoading,
    error: photosError,
  } = useQuery<VillaPhoto[], Error>({
    queryKey: ["villaPhotos", villaId],
    enabled: !!villaId && !!token,
    queryFn: async () => {
      const { data } = await axios.get<VillaPhoto[]>(
        `${API_BASE_URL}/villa/${villaId}/photos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
  });

  // --- Fetch Calendar Days ---
  const {
    data: calendar_days = [],
    isLoading: calendarLoading,
    error: calendarError,
    refetch: refetchCalendar,
  } = useQuery<VillaCalendarDay[], Error>({
    queryKey: ["villaCalendar", villaId],
    enabled: !!villaId && !!token,
    queryFn: async () => {
      const { data } = await axios.get<VillaCalendarDay[]>(
        `${API_BASE_URL}/villa/${villaId}/calendar`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
  });

  // --- Fetch Pricing Overrides ---
  const {
    data: pricing_overrides = [],
    isLoading: pricingLoading,
    error: pricingError,
    refetch: refetchPricing,
  } = useQuery<VillaPricingOverride[], Error>({
    queryKey: ["villaPricingOverrides", villaId],
    enabled: !!villaId && !!token,
    queryFn: async () => {
      const { data } = await axios.get<VillaPricingOverride[]>(
        `${API_BASE_URL}/villa/${villaId}/pricing-overrides`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
  });

  // --- Fetch all host reservations, filter for this villa ---
  const {
    data: allHostBookings = [],
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useQuery<Booking[], Error>({
    queryKey: ["hostReservations", villaId], // villaId for scope
    enabled: !!token,
    queryFn: async () => {
      const { data } = await axios.get<Booking[]>(
        `${API_BASE_URL}/host/reservations`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
  });
  const reservations =
    allHostBookings?.filter((b) => b.villa_id === villaId) || [];

  // --- Fetch Villa Reviews ---
  type VillaReviewResponse = {
    reviews: UserReview[];
    avg_rating: number;
    total_reviews: number;
  };
  const {
    data: villaReviewData,
    isLoading: reviewsLoading,
    error: reviewsError,
    refetch: refetchReviews,
  } = useQuery<VillaReviewResponse, Error>({
    queryKey: ["villaReviews", villaId],
    enabled: !!villaId && !!token,
    queryFn: async () => {
      const { data } = await axios.get<VillaReviewResponse>(
        `${API_BASE_URL}/villas/${villaId}/reviews`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
  });
  const villa_reviews = villaReviewData?.reviews || [];
  const avg_rating = villaReviewData?.avg_rating ?? 0;
  const total_reviews = villaReviewData?.total_reviews ?? 0;

  // --- Mutations: Calendar PATCH ---
  const [calendarToEdit, setCalendarToEdit] = React.useState<VillaCalendarDay[]>([]);
  const [calendar_patch_error, setCalendarPatchError] = React.useState<string | null>(null);
  const [is_calendar_loading, setIsCalendarLoading] = React.useState(false);

  const calendarMutation = useMutation<
    VillaCalendarDay[],
    Error,
    VillaCalendarDay[]
  >({
    mutationFn: async (calendar: VillaCalendarDay[]) => {
      setIsCalendarLoading(true);
      setCalendarPatchError(null);
      const { data } = await axios.patch<VillaCalendarDay[]>(
        `${API_BASE_URL}/villa/${villaId}/calendar`,
        calendar,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["villaCalendar", villaId], data);
      setCalendarToEdit([]); // Clear scratch edits
      refetchCalendar();
      setIsCalendarLoading(false);
    },
    onError: (error) => {
      setCalendarPatchError(error.message || "Calendar update failed.");
      setIsCalendarLoading(false);
    },
  });

  // --- Mutations: Pricing Overrides PATCH ---
  const [pricingToEdit, setPricingToEdit] = React.useState<VillaPricingOverride[]>([]);
  const [pricing_patch_error, setPricingPatchError] = React.useState<string | null>(null);
  const [is_pricing_loading, setIsPricingLoading] = React.useState(false);

  const pricingMutation = useMutation<
    VillaPricingOverride[],
    Error,
    VillaPricingOverride[]
  >({
    mutationFn: async (overrides: VillaPricingOverride[]) => {
      setIsPricingLoading(true);
      setPricingPatchError(null);
      const { data } = await axios.patch<VillaPricingOverride[]>(
        `${API_BASE_URL}/villa/${villaId}/pricing-overrides`,
        overrides,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["villaPricingOverrides", villaId], data);
      setPricingToEdit([]); // Clear scratch edits
      refetchPricing();
      setIsPricingLoading(false);
    },
    onError: (error) => {
      setPricingPatchError(error.message || "Pricing update failed.");
      setIsPricingLoading(false);
    },
  });

  // --- Calendar + Pricing scratch edits: populate on fresh fetch ---
  React.useEffect(() => {
    if (calendar_days.length > 0) {
      setCalendarToEdit(calendar_days.map((d) => ({ ...d })));
    }
  }, [calendar_days]);

  React.useEffect(() => {
    if (pricing_overrides.length > 0) {
      setPricingToEdit(pricing_overrides.map((p) => ({ ...p })));
    }
  }, [pricing_overrides]);

  // --- Loading/error state for overall page ---
  const overallLoading =
    villaLoading ||
    photosLoading ||
    calendarLoading ||
    pricingLoading ||
    bookingsLoading ||
    reviewsLoading;
  const overallError =
    villaError ||
    photosError ||
    calendarError ||
    pricingError ||
    bookingsError ||
    reviewsError;

  // --- Carousel state ---
  const [carouselIdx, setCarouselIdx] = React.useState(0);
  const mainPhotoIdx = villa_photos.findIndex((p) => p.is_main);
  React.useEffect(() => {
    if (mainPhotoIdx !== -1) setCarouselIdx(mainPhotoIdx);
  }, [mainPhotoIdx]);

  // --- Calendar table utilities ---
  function updateCalendarDay(idx: number, field: keyof VillaCalendarDay, value: any) {
    setCalendarToEdit((prev) =>
      prev.map((day, i) =>
        i === idx ? { ...day, [field]: value } : day
      )
    );
  }
  function onSaveCalendar(e: React.FormEvent) {
    e.preventDefault();
    calendarMutation.mutate(calendarToEdit);
  }
  function updatePricingOverride(idx: number, field: keyof VillaPricingOverride, value: any) {
    setPricingToEdit((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, [field]: value } : row
      )
    );
  }
  function onSavePricing(e: React.FormEvent) {
    e.preventDefault();
    pricingMutation.mutate(pricingToEdit);
  }

  // --- Shortcut filter: Upcoming reservations (future checkin) ---
  const today = new Date();
  const upcoming_reservations = reservations.filter(
    (b) =>
      new Date(b.checkin_date) >= today &&
      ["confirmed", "pending", "requested"].includes(b.status)
  );

  // --- Render ---
  return (
    <>
      {overallLoading && (
        <div className="fixed top-0 left-0 w-full h-full z-30 bg-white/80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-400 border-solid"></div>
        </div>
      )}

      {overallError && (
        <div className="bg-red-100 border border-red-300 text-red-850 p-4 rounded mt-6 max-w-2xl mx-auto">
          <div className="text-lg font-semibold mb-1">Error loading villa detail</div>
          <div className="break-all">{String(overallError.message)}</div>
        </div>
      )}

      {!overallLoading && !overallError && villa && (
        <div className="max-w-7xl mx-auto w-full px-4 py-8">
          {/* ---- Top: Villa Overview & Actions ---- */}
          <div className="flex flex-col md:flex-row gap-8 mb-10">
            {/* Photo Carousel */}
            <div className="w-full md:w-2/5">
              {villa_photos.length > 0 ? (
                <div className="relative">
                  <img
                    className="rounded-xl w-full h-72 object-cover"
                    src={villa_photos[carouselIdx]?.photo_url}
                    alt={`Villa photo #${carouselIdx + 1}`}
                  />
                  <button
                    className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-white/80 rounded-full px-2 py-1 shadow-lg hover:bg-white"
                    onClick={() =>
                      setCarouselIdx(
                        carouselIdx === 0
                          ? villa_photos.length - 1
                          : carouselIdx - 1
                      )
                    }
                    aria-label="Previous Photo"
                  >
                    ◀
                  </button>
                  <button
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-white/80 rounded-full px-2 py-1 shadow-lg hover:bg-white"
                    onClick={() =>
                      setCarouselIdx(
                        carouselIdx === villa_photos.length - 1
                          ? 0
                          : carouselIdx + 1
                      )
                    }
                    aria-label="Next Photo"
                  >
                    ▶
                  </button>
                  <div className="flex justify-center mt-2 gap-2">
                    {villa_photos.map((p, i) => (
                      <img
                        key={p.villa_photo_id}
                        className={`w-10 h-10 object-cover rounded cursor-pointer border ${
                          i === carouselIdx
                            ? "border-blue-400"
                            : "border-transparent"
                        }`}
                        src={p.photo_url}
                        alt={`thumb-${i + 1}`}
                        onClick={() => setCarouselIdx(i)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full h-72 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                  No photos uploaded
                </div>
              )}
            </div>

            {/* Villa Summary */}
            <div className="w-full md:w-3/5 flex flex-col gap-3">
              <div className="flex flex-row justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold">{villa.title}</h1>
                  <div className="text-gray-600">{villa.address_city}, {villa.address_country}</div>
                  <div className="text-sm text-gray-500">ID: {villa.villa_id}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-yellow-500 text-xl">★</span>
                    <span className="text-lg font-semibold">{(avg_rating || 0).toFixed(2)}</span>
                    <span className="text-gray-500 text-sm">
                      / 5 · {total_reviews} review{total_reviews === 1 ? "" : "s"}
                    </span>
                  </div>
                  {villa.is_active ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium mt-1">
                      Active Listing
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-xs font-medium mt-1">
                      Inactive
                    </span>
                  )}
                  {villa.is_instant_book && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                      Instant Book
                    </span>
                  )}
                </div>
                <div>
                  <Link
                    to={`/host/villa/${villa.villa_id}/edit`}
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg shadow font-semibold hover:bg-blue-700 transition"
                  >
                    Edit Listing
                  </Link>
                </div>
              </div>
              {villa.description_short && (
                <div className="text-md mt-1 text-gray-700">
                  {villa.description_short}
                </div>
              )}
              {villa.house_rules && (
                <div className="text-sm mt-1 text-gray-700">
                  <span className="font-semibold">House Rules:</span> {villa.house_rules}
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <span className="font-medium">Bedrooms:</span> {villa.bedrooms}
                </div>
                <div>
                  <span className="font-medium">Beds:</span> {villa.beds}
                </div>
                <div>
                  <span className="font-medium">Bathrooms:</span> {villa.bathrooms}
                </div>
                <div>
                  <span className="font-medium">Max Guests:</span> {villa.max_guests}
                </div>
              </div>
              <div className="flex gap-4 mt-2">
                <div>
                  <span className="font-medium">Nightly base price:</span>
                  <span className="ml-1">${villa?.price_per_night?.toFixed(2) || '0.00'}</span>
                </div>
                <div>
                  <span className="font-medium">Cleaning fee:</span>
                  <span className="ml-1">${villa?.cleaning_fee?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
              <div className="flex gap-4 mt-2">
                <Link
                  to={`/messaging?villa=${villa.villa_id}`}
                  className="inline-flex items-center px-3 py-1.5 bg-gray-200 text-blue-800 rounded hover:bg-blue-50"
                >
                  Messages
                </Link>
                <a
                  href="#upcoming-reservations"
                  className="inline-flex items-center px-3 py-1.5 bg-gray-200 text-blue-800 rounded hover:bg-blue-50"
                >
                  Upcoming Bookings
                </a>
              </div>
            </div>
          </div>

          {/* ---- Calendar Management ---- */}
          <div className="bg-gray-50 rounded-xl p-6 mb-10 shadow-sm">
            <h2 className="text-xl font-bold mb-2">Availability Calendar Management</h2>
            <p className="text-sm text-gray-500 mb-4">
              Mark days as available/unavailable and adjust per-date prices.
            </p>
            {calendar_patch_error && (
              <div className="mb-3 bg-red-100 text-red-700 border px-3 py-2 rounded text-sm">
                {calendar_patch_error}
              </div>
            )}
            <form onSubmit={onSaveCalendar}>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-1">Date</th>
                      <th className="px-2 py-1">Available?</th>
                      <th className="px-2 py-1">Reason (if blocked)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarToEdit.map((day, i) => (
                      <tr key={day.date}>
                        <td className="px-2 py-1">{formatDate(day.date)}</td>
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            checked={day.is_available}
                            onChange={e =>
                              updateCalendarDay(i, "is_available", e.target.checked)
                            }
                            disabled={is_calendar_loading}
                            className="scale-125"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={day.reason || ""}
                            onChange={e =>
                              updateCalendarDay(i, "reason", e.target.value)
                            }
                            disabled={is_calendar_loading || day.is_available}
                            className={`border px-1 rounded w-full ${day.is_available ? "bg-gray-100" : ""}`}
                            placeholder="Reason for blocking date"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="submit"
                className={`mt-3 px-4 py-2 rounded bg-blue-700 text-white font-semibold shadow hover:bg-blue-800 transition ${
                  is_calendar_loading ? "opacity-70 pointer-events-none" : ""
                }`}
                disabled={is_calendar_loading}
              >
                {is_calendar_loading ? "Saving Calendar..." : "Save Calendar Changes"}
              </button>
            </form>
          </div>

          {/* ---- Pricing Override Management ---- */}
          <div className="bg-gray-50 rounded-xl p-6 mb-10 shadow-sm">
            <h2 className="text-xl font-bold mb-2">Per-Date Price Overrides</h2>
            <p className="text-sm text-gray-500 mb-4">
              Adjust nightly prices, min/max stay per date (leave blank for default).
            </p>
            {pricing_patch_error && (
              <div className="mb-3 bg-red-100 text-red-700 border px-3 py-2 rounded text-sm">
                {pricing_patch_error}
              </div>
            )}
            <form onSubmit={onSavePricing}>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-1">Date</th>
                      <th className="px-2 py-1">Nightly Price ($)</th>
                      <th className="px-2 py-1">Min Nights</th>
                      <th className="px-2 py-1">Max Nights</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingToEdit.map((p, i) => (
                      <tr key={p.date}>
                        <td className="px-2 py-1">{formatDate(p.date)}</td>
                        <td className="px-2 py-1">
                          <input
                            className="border px-1 rounded w-24"
                            type="number"
                            min={1}
                            value={p.nightly_price}
                            onChange={e =>
                              updatePricingOverride(i, "nightly_price", Number(e.target.value))
                            }
                            disabled={is_pricing_loading}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="border px-1 rounded w-12"
                            type="number"
                            min={1}
                            value={p.min_nights ?? ""}
                            onChange={e =>
                              updatePricingOverride(
                                i,
                                "min_nights",
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                            disabled={is_pricing_loading}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="border px-1 rounded w-12"
                            type="number"
                            min={1}
                            value={p.max_nights ?? ""}
                            onChange={e =>
                              updatePricingOverride(
                                i,
                                "max_nights",
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                            disabled={is_pricing_loading}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="submit"
                className={`mt-3 px-4 py-2 rounded bg-blue-700 text-white font-semibold shadow hover:bg-blue-800 transition ${
                  is_pricing_loading ? "opacity-70 pointer-events-none" : ""
                }`}
                disabled={is_pricing_loading}
              >
                {is_pricing_loading ? "Saving Prices..." : "Save Pricing Changes"}
              </button>
            </form>
          </div>

          {/* ---- Reservation History ---- */}
          <div id="upcoming-reservations" className="mb-10">
            <h2 className="text-xl font-bold mb-2">Reservations & Booking History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm border mb-3">
                <thead>
                  <tr>
                    <th className="px-2 py-1">Guest UID</th>
                    <th className="px-2 py-1">Check-in</th>
                    <th className="px-2 py-1">Check-out</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Price Paid</th>
                    <th className="px-2 py-1">Booking</th>
                    <th className="px-2 py-1">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500">
                        No reservations to display yet.
                      </td>
                    </tr>
                  ) : (
                    reservations.map((b) => (
                      <tr key={b.booking_id}>
                        <td className="px-2 py-1 font-mono">{b.guest_user_id}</td>
                        <td className="px-2 py-1">{formatDate(b.checkin_date)}</td>
                        <td className="px-2 py-1">{formatDate(b.checkout_date)}</td>
                        <td className="px-2 py-1">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${statusColors[b.status] || "bg-gray-200 text-gray-900"
                              }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="px-2 py-1">${b.total_price.toFixed(2)}</td>
                        <td className="px-2 py-1">
                          <Link
                            to={`/reservation/${b.booking_id}`}
                            className="text-blue-600 underline hover:text-blue-900"
                          >
                            Details
                          </Link>
                        </td>
                        <td className="px-2 py-1">
                          <Link
                            to={`/messaging?booking=${b.booking_id}`}
                            className="text-blue-800 hover:underline"
                          >
                            Message
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-sm text-gray-500 mb-4">
              Tip: You can message guests directly from this table.
            </div>
          </div>

          {/* ---- Guest Reviews ---- */}
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-2">Guest Reviews</h2>
            {villa_reviews.length === 0 ? (
              <div className="text-gray-500 mb-2">No reviews yet for this villa.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {villa_reviews.map((r) => (
                  <div
                    key={r.review_id}
                    className="bg-white rounded-md border p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-yellow-500">★</span>
                      <span className="text-lg font-semibold">
                        {r.rating}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        {formatDate(r.created_at)}
                      </span>
                      {r.is_edited && (
                        <span className="ml-1 text-xs italic text-gray-400">(edited)</span>
                      )}
                    </div>
                    <div className="ml-1 text-gray-700 text-sm mt-1">{r.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default UV_HostVillaDetail;