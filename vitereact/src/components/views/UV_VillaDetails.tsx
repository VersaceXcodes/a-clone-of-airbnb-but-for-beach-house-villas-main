import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";

// Zod schemas for type safety
import {
  villaSchema,
  villaPhotoSchema,
  villaRuleSchema,
  villaAmenitySchema,
  villaPricingOverrideSchema,
  villaCalendarSchema,
  userReviewSchema,
  villaWishlistSchema,
} from "@schema";

// --- Types ---
type Villa = typeof villaSchema._type;
type VillaPhoto = typeof villaPhotoSchema._type;
type VillaRule = typeof villaRuleSchema._type;
type VillaAmenity = typeof villaAmenitySchema._type;
type VillaPricingOverride = typeof villaPricingOverrideSchema._type;
type VillaCalendar = typeof villaCalendarSchema._type;
type UserReview = typeof userReviewSchema._type;
type VillaWishlist = typeof villaWishlistSchema._type;

type BookingPreviewPayload = {
  checkin_date: string;
  checkout_date: string;
  num_guests: number;
};
type BookingPreviewResponse = {
  available: boolean;
  price_summary?: {
    nightly_price: number;
    cleaning_fee: number;
    service_fee: number;
    taxes: number;
    total_price: number;
  };
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const UV_VillaDetails: React.FC = () => {
  // ---- Route Param ----
  const { villaId } = useParams<{ villaId: string }>();
  const villa_id = villaId || "";

  // ---- Zustand Global Store ----
  const user_id = useAppStore((state) => state.user_session.user_id);
  const is_authenticated = useAppStore(
    (state) => state.user_session.is_authenticated
  );
  const token = useAppStore((state) => state.user_session.token);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ---- Local UI States ----
  const [bookingWidget, setBookingWidget] = useState<{
    checkin_date: string | null;
    checkout_date: string | null;
    num_guests: number;
  }>({
    checkin_date: null,
    checkout_date: null,
    num_guests: 1,
  });
  const [saveToWishlistOpen, setSaveToWishlistOpen] = useState(false);
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(
    null
  );
  const [contactHostModalOpen, setContactHostModalOpen] = useState(false);
  const [contactHostMessage, setContactHostMessage] = useState("");
  const [previewTrigger, setPreviewTrigger] = useState(0);
  const [reviewSort, setReviewSort] = useState<"date" | "rating">("date");
  const [reviewsPage, setReviewsPage] = useState(1);

  // --- Scroll to gallery (for zoom) ---
  const galleryRef = useRef<HTMLDivElement | null>(null);

  // ---- Fetch: Villa Details ----
  const {
    data: villa,
    isLoading: villaLoading,
    isError: villaError,
    error: villaErrorData,
  } = useQuery<Villa, Error>({
    queryKey: ["villa", villa_id],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/villas/${villa_id}`);
      return data;
    },
    enabled: !!villa_id,
  });

  // ---- Fetch: Photos ----
  const {
    data: photos = [],
    isLoading: photosLoading,
    isError: photosError,
  } = useQuery<VillaPhoto[], Error>({
    queryKey: ["villaPhotos", villa_id],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/villas/${villa_id}/photos`);
      if (Array.isArray(data) && data.length > 0) return data;
      return [
        {
          villa_photo_id: "sample",
          villa_id,
          photo_url: "https://picsum.photos/id/1011/1200/600",
          ordering: 1,
          is_main: true,
          uploaded_at: new Date().toISOString(),
        },
      ];
    },
    enabled: !!villa_id,
  });

  // ---- Fetch: Amenities ----
  const {
    data: amenities = [],
    isLoading: amenitiesLoading,
    isError: amenitiesError,
  } = useQuery<VillaAmenity[], Error>({
    queryKey: ["villaAmenities", villa_id],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/villas/${villa_id}/amenities`
      );
      return data;
    },
    enabled: !!villa_id,
  });

  // ---- Fetch: Rules ----
  const {
    data: rules = [],
    isLoading: rulesLoading,
    isError: rulesError,
  } = useQuery<VillaRule[], Error>({
    queryKey: ["villaRules", villa_id],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/villas/${villa_id}/rules`);
      return data;
    },
    enabled: !!villa_id,
  });

  // ---- Fetch: Calendar ----
  const {
    data: calendar = [],
    isLoading: calendarLoading,
    isError: calendarError,
  } = useQuery<VillaCalendar[], Error>({
    queryKey: ["villaCalendar", villa_id],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/villas/${villa_id}/calendar`);
      return data;
    },
    enabled: !!villa_id,
  });

  // ---- Fetch: Pricing Overrides ----
  const {
    data: pricing_overrides = [],
    isLoading: priceOverrideLoading,
    isError: priceOverrideError,
  } = useQuery<VillaPricingOverride[], Error>({
    queryKey: ["villaPricingOverride", villa_id],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/villas/${villa_id}/pricing-overrides`
      );
      return data;
    },
    enabled: !!villa_id,
  });

  // ---- Fetch: Reviews ----
  const {
    data: reviewsResp,
    isLoading: reviewsLoading,
    isError: reviewsError,
  } = useQuery<
    { reviews: UserReview[]; avg_rating: number; total_reviews: number },
    Error
  >({
    queryKey: ["villaReviews", villa_id, reviewsPage],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_BASE}/villas/${villa_id}/reviews?page=${reviewsPage}`
      );
      // Convert review ids to string in case backend returns numbers
      return {
        reviews: (Array.isArray(data.reviews) ? data.reviews : []).map((r) => ({
          ...r,
          review_id: String(r.review_id),
          booking_id: String(r.booking_id),
        })),
        avg_rating: data.avg_rating,
        total_reviews: data.total_reviews,
      };
    },
    enabled: !!villa_id,
  });

  const reviews: UserReview[] = useMemo(() => {
    if (!reviewsResp) return [];
    let arr = reviewsResp.reviews.slice();
    if (reviewSort === "rating") {
      arr = arr.sort((a, b) => b.rating - a.rating);
    } else {
      arr = arr.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return arr;
  }, [reviewsResp, reviewSort]);

  // ---- Fetch: Host Profile (for host card) ----
  // Note: OpenAPI gives only /account/me -- no public /users/:id, so we only have host info from villa if possible
  //      (PRD/UI wants full host card, but OpenAPI is limited here)
  //      For now, use villa.owner_user_id and relevant villa fields, fallback to N/A.
  //      TODO: If /users/:id endpoint added, fetch and use.
  const host = useMemo(
    () =>
      villa
        ? {
            user_id: String(villa.owner_user_id),
            display_name: "Host",
            profile_photo_url:
              "https://picsum.photos/seed/" + villa.owner_user_id + "/80",
            is_superhost: false, // No way to get superhost status for others from API
          }
        : null,
    [villa]
  );

  // ---- Fetch: User Wishlists (if needed) ----
  const {
    data: userWishlists = [],
    isLoading: wishlistsLoading,
    isError: wishlistsError,
    refetch: refetchWishlists,
  } = useQuery<VillaWishlist[], Error>({
    queryKey: ["userWishlists", user_id],
    queryFn: async () => {
      if (!token) throw new Error("Not authenticated");
      const { data } = await axios.get(`${API_BASE}/account/wishlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Convert ids to string
      return data.map((wl: any) => ({
        ...wl,
        wishlist_id: String(wl.wishlist_id),
        villa_ids: (wl.villa_ids || []).map((vid: any) => String(vid)),
      }));
    },
    enabled: saveToWishlistOpen && !!token,
  });

  // --- Booking Price Preview ---
  const {
    data: bookingPreview,
    isLoading: bookingPreviewLoading,
    isError: bookingPreviewError,
    refetch: refetchBookingPreview,
  } = useQuery<BookingPreviewResponse, Error>({
    queryKey: [
      "bookingPreview",
      villa_id,
      bookingWidget.checkin_date,
      bookingWidget.checkout_date,
      bookingWidget.num_guests,
      previewTrigger,
    ],
    queryFn: async () => {
      if (
        !bookingWidget.checkin_date ||
        !bookingWidget.checkout_date ||
        !bookingWidget.num_guests
      ) {
        throw new Error("Please select dates and number of guests");
      }
      const payload = {
        checkin_date: bookingWidget.checkin_date,
        checkout_date: bookingWidget.checkout_date,
        num_guests: bookingWidget.num_guests,
      };
      const { data } = await axios.post(
        `${API_BASE}/villas/${villa_id}/booking/preview`,
        payload
      );
      return data;
    },
    enabled:
      !!villa_id &&
      !!bookingWidget.checkin_date &&
      !!bookingWidget.checkout_date &&
      !!bookingWidget.num_guests,
    retry: false,
  });

  // --- Save to Wishlist Mutation ---
  const addToWishlistMutation = useMutation<
    any,
    Error,
    { wishlist_id: string; villa_id: string }
  >({
    mutationFn: async ({ wishlist_id, villa_id }) => {
      if (!token)
        throw new Error("You must be logged in to save to a wishlist.");
      const { data } = await axios.put(
        `${API_BASE}/account/wishlists/${wishlist_id}/villas/${villa_id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    onSuccess: () => {
      refetchWishlists();
      setSaveToWishlistOpen(false);
      setSelectedWishlistId(null);
    },
    onError: (err) => {
      window.alert(
        err.message ||
          "Could not add to wishlist. Please try again or refresh the page."
      );
    },
  });

  // --- Contact Host Mutation ---
  const contactHostMutation = useMutation<
    { thread_id: string },
    Error,
    { content: string }
  >({
    mutationFn: async ({ content }) => {
      if (!token) throw new Error("You must be logged in to contact the host.");
      const { data } = await axios.post(
        `${API_BASE}/villas/${villa_id}/contact-host`,
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data.thread_id && data.thread_id !== 0 && data.thread_id !== "0")
        throw new Error("Failed to create message thread");
      return { thread_id: String(data.thread_id) };
    },
    onSuccess: (res) => {
      setContactHostModalOpen(false);
      setContactHostMessage("");
      navigate(`/messaging/thread/${res.thread_id}`);
    },
    onError: (err) => {
      window.alert(
        err.message ||
          "Could not contact host. Please try again or refresh the page."
      );
    },
  });

  // --- Derived: calendar dates (disabled, available, etc.) for booking ---
  // Just pass-through for now. Can be extended for a calendar UI.

  // --- Gallery Carousel Logic ---
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const showPrevPhoto = () =>
    setCurrentPhotoIdx((i) => (i === 0 ? photos.length - 1 : i - 1));
  const showNextPhoto = () =>
    setCurrentPhotoIdx((i) => (i === photos.length - 1 ? 0 : i + 1));

  // --- Effects for preview/calculate booking price on widget changes ---
  useEffect(() => {
    if (
      bookingWidget.checkin_date &&
      bookingWidget.checkout_date &&
      bookingWidget.num_guests
    ) {
      setPreviewTrigger((p) => p + 1); // Triggers refetch on dependency change
    }
  }, [
    bookingWidget.checkin_date,
    bookingWidget.checkout_date,
    bookingWidget.num_guests,
  ]);

  // -- Utilities --
  function formatCurrency(num: number | undefined) {
    if (typeof num !== "number") return "--";
    return "$" + num.toLocaleString();
  }
  function formatDate(str: string | undefined | null) {
    if (!str) return "";
    const d = new Date(str);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  // --- Error/fallback boundary for villa not found or fetch error ---
  if (villaLoading) {
    return (
      <div className="w-full py-24 text-center text-lg font-semibold">
        Loading villa information...
      </div>
    );
  }
  if (villaError) {
    return (
      <div className="w-full py-24 text-center text-lg text-red-700 font-semibold">
        <div>
          Could not load villa details.{" "}
          {villaErrorData?.message && (
            <div className="mt-1 text-sm">{villaErrorData.message}</div>
          )}
        </div>
        <Link
          to="/"
          className="inline-block mt-4 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Back to Home
        </Link>
      </div>
    );
  }
  if (!villa) {
    return (
      <div className="w-full py-24 text-center text-lg font-semibold">
        Villa not found.
      </div>
    );
  }

  // --- Main render ---
  return (
    <>
      {/* Main Layout is 2 column (lg+) or stacked (base) */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* --- LEFT: Main (spans 2 cols) --- */}
        <div className="col-span-2">
          {/* Title + subtitle/rating */}
          <div className="mb-4 flex flex-col gap-1">
            <div className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
              {villa.title || "Untitled Villa"}
              {villa.is_instant_book && (
                <span className="ml-2 inline-block px-2 py-0.5 text-xs font-bold bg-green-100 text-green-800 rounded">
                  Instant Book
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center text-gray-600 text-sm">
              <span>
                {villa.address_city}, {villa.address_country}
              </span>
              <span className="mx-1 text-gray-400">·</span>
              <span>
                {formatCurrency(villa.price_per_night)} / night
              </span>
              <span className="mx-1 text-gray-400">·</span>
              <span className="flex items-center">
                <span className="text-yellow-500 mr-1">★</span>
                {reviewsResp ? (reviewsResp.avg_rating || 0).toFixed(2) : "--"}
                <span className="ml-1 text-gray-500">
                  ({reviewsResp ? reviewsResp.total_reviews : 0} reviews)
                </span>
              </span>
            </div>
          </div>
          {/* --- Gallery Carousel --- */}
          <div
            ref={galleryRef}
            className="relative aspect-[2/1] w-full rounded-lg overflow-hidden bg-gray-100 mb-6"
          >
            {photos.length > 0 && (
              <img
                src={photos[currentPhotoIdx]?.photo_url}
                className="object-cover w-full h-full transition-opacity max-h-[500px]"
                alt={`Villa Gallery Photo #${currentPhotoIdx + 1}`}
                draggable={false}
                loading="eager"
              />
            )}
            {/* Carousel Controls */}
            {photos.length > 1 && (
              <>
                <button
                  className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-gray-200"
                  onClick={showPrevPhoto}
                  aria-label="Previous Photo"
                >
                  ◀
                </button>
                <button
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-gray-200"
                  onClick={showNextPhoto}
                  aria-label="Next Photo"
                >
                  ▶
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                  {photos.map((_, idx) => (
                    <button
                      key={String(idx)}
                      className={
                        "w-2 h-2 rounded-full " +
                        (idx === currentPhotoIdx
                          ? "bg-blue-600"
                          : "bg-white border border-gray-400")
                      }
                      onClick={() => setCurrentPhotoIdx(idx)}
                      aria-label={`Show Photo ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {/* --- Description & Amenities --- */}
          <div className="mb-8">
            <div className="text-lg font-semibold mb-1">About this villa</div>
            <div className="text-md text-gray-700 mb-2 whitespace-pre-line">
              {villa.description_long || villa.description_short || "No description available."}
            </div>
            <div className="flex flex-wrap gap-4 mb-2">
              <span>
                <b>{villa.bedrooms}</b> bedrooms
              </span>
              <span>
                <b>{villa.beds}</b> beds
              </span>
              <span>
                <b>{villa.bathrooms}</b> bathrooms
              </span>
              <span>
                <b>Up to {villa.max_guests}</b> guests
              </span>
              {villa.is_beachfront && (
                <span className="bg-blue-100 px-2 py-1 rounded text-blue-800 font-semibold text-xs">
                  Beachfront
                </span>
              )}
              {villa.is_pet_friendly && (
                <span className="bg-yellow-100 px-2 py-1 rounded text-yellow-800 font-semibold text-xs">
                  Pet friendly
                </span>
              )}
            </div>
            {/* Amenities List */}
            <div>
              <div className="font-semibold mb-1 mt-3">Amenities</div>
              <div className="flex flex-wrap gap-2">
                {amenities.length > 0 ? (
                  amenities.map((am) => (
                    <div
                      className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded text-gray-700 text-sm"
                      key={String(am.amenity_id)}
                    >
                      {am.icon_url && (
                        <img
                          className="w-5 h-5 mr-1 inline-block"
                          src={am.icon_url}
                          alt={am.label}
                        />
                      )}
                      {am.label}
                    </div>
                  ))
                ) : (
                  <span className="text-gray-400">No amenities listed.</span>
                )}
              </div>
            </div>
          </div>
          {/* --- Map --- */}
          <div className="mb-8">
            <div className="font-semibold mb-1">Where you'll be</div>
            <div className="w-full h-64 bg-gray-200 rounded-lg relative overflow-hidden">
              {villa.latitude && villa.longitude ? (
                <iframe
                  title="Villa Location"
                  className="absolute w-full h-full left-0 top-0"
                  src={`https://maps.google.com/maps?q=${villa.latitude},${villa.longitude}&z=13&output=embed`}
                  frameBorder={0}
                  aria-label="Map"
                ></iframe>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-600">
                  Map not available.
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-white/70 rounded px-3 py-1 text-xs text-gray-800">
                Address is approximate for privacy.
              </div>
            </div>
          </div>
          {/* --- House Rules & Cancellation Policy --- */}
          <div className="mb-8">
            <div className="font-semibold mb-1">House Rules</div>
            {rules.length > 0 ? (
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                {rules.map((rule) => (
                  <li key={String(rule.villa_rule_id)}>
                    <span className="font-semibold">{rule.rule_type}: </span>
                    {rule.allowed ? "Allowed" : "Not allowed"}
                    {rule.notes && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({rule.notes})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-400">No house rules provided.</div>
            )}
            <div className="mt-2">
              <span className="font-semibold">Cancellation Policy:</span>{" "}
              <span className="capitalize">
                {villa.cancellation_policy?.replace("_", " ")}
              </span>
            </div>
          </div>
          {/* --- Host Profile --- */}
          <div className="mb-8 flex gap-6 items-center">
            <div>
              <img
                src={
                  host?.profile_photo_url ||
                  "https://picsum.photos/seed/host/80"
                }
                alt={host?.display_name || "Host"}
                className="rounded-full border w-16 h-16 object-cover"
              />
            </div>
            <div>
              <div className="font-semibold text-gray-800">
                Hosted by {host?.display_name || "N/A"}
                {host?.is_superhost && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 rounded">
                    Superhost
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {/* For now, fake since OpenAPI doesn't give host stats */}
                Profile not available.
              </div>
            </div>
          </div>
          {/* --- Reviews --- */}
          <div className="mb-8">
            <div className="flex items-center mb-2">
              <span className="text-lg font-bold mr-3">
                Reviews ({reviewsResp?.total_reviews || 0})
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 font-semibold">
                  Sort by:
                </label>
                <select
                  className="text-xs border border-gray-300 rounded px-1 py-0.5"
                  value={reviewSort}
                  onChange={(e) =>
                    setReviewSort(e.target.value as "date" | "rating")
                  }
                >
                  <option value="date">Most Recent</option>
                  <option value="rating">Rating</option>
                </select>
              </div>
            </div>
            {reviewsLoading ? (
              <div className="text-gray-500">Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="text-gray-400">No reviews yet!</div>
            ) : (
              <div className="space-y-4">
                {reviews.map((rv) => (
                  <div
                    key={String(rv.review_id)}
                    className="border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-yellow-500 font-bold">★</span>
                      <span className="font-semibold text-md">
                        {rv.rating}
                      </span>
                      <span className="text-xs text-gray-400 ml-3">
                        {formatDate(rv.created_at)}
                      </span>
                    </div>
                    <div className="text-gray-800">{rv.text}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Pagination (if more than one page) */}
            {reviewsResp &&
              reviewsResp.total_reviews > 10 && (
                <div className="flex gap-2 justify-end mt-3">
                  <button
                    className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60"
                    disabled={reviewsPage === 1}
                    onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60"
                    disabled={
                      reviewsPage >=
                      Math.ceil(
                        reviewsResp.total_reviews /
                          (Array.isArray(reviews) && reviews.length > 0
                            ? reviews.length
                            : 10)
                      )
                    }
                    onClick={() => setReviewsPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
          </div>
        </div>
        {/* --- RIGHT: Sticky Booking Rail --- */}
        <div className="col-span-1 relative">
          <div className="lg:sticky top-8 border rounded-lg shadow p-6 bg-white mb-6">
            <div className="flex items-center gap-4 mb-3 justify-between">
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(villa.price_per_night)}{" "}
                <span className="text-sm text-gray-500 font-normal">
                  / night
                </span>
              </div>
              {/* Save to Wishlist / Share */}
              <div className="flex items-center gap-2">
                {/* Wishlist: */}
                <button
                  className="p-2 rounded-full hover:bg-red-100 transition"
                  onClick={() => {
                    if (!is_authenticated) {
                      window.alert(
                        "Please sign in to save to a wishlist."
                      );
                      return;
                    }
                    setSaveToWishlistOpen(true);
                  }}
                  title={
                    is_authenticated
                      ? "Save to wishlist"
                      : "Sign in to save villas"
                  }
                  aria-label="Save to Wishlist"
                >
                  <span className="text-xl text-red-500">♥</span>
                </button>
                {/* Share */}
                <button
                  className="p-2 rounded-full hover:bg-blue-100 transition"
                  onClick={() => {
                    // Share: Use navigator.share if available, otherwise copy URL
                    const shareUrl =
                      window.location.origin + `/villa/${villa_id}`;
                    if ((window as any).navigator.share) {
                      (window as any).navigator
                        .share({
                          title: villa.title,
                          url: shareUrl,
                        })
                        .catch(() => {});
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      window.alert("Villa link copied to clipboard!");
                    }
                  }}
                  aria-label="Share Villa"
                  title="Share"
                >
                  <span className="text-blue-500 text-lg">⤴</span>
                </button>
              </div>
            </div>
            {/* Booking Form */}
            <div className="flex flex-col gap-2 mb-3">
              <label className="text-xs text-gray-500 font-semibold">
                Dates
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="border px-2 py-1 rounded"
                  value={bookingWidget.checkin_date || ""}
                  min={formatDate(new Date().toISOString())}
                  onChange={(e) =>
                    setBookingWidget((w) => ({
                      ...w,
                      checkin_date: e.target.value,
                    }))
                  }
                />
                <span className="text-gray-400 font-bold">→</span>
                <input
                  type="date"
                  className="border px-2 py-1 rounded"
                  value={bookingWidget.checkout_date || ""}
                  disabled={!bookingWidget.checkin_date}
                  min={bookingWidget.checkin_date || ""}
                  onChange={(e) =>
                    setBookingWidget((w) => ({
                      ...w,
                      checkout_date: e.target.value,
                    }))
                  }
                />
              </div>
              <label className="text-xs text-gray-500 font-semibold">
                Guests
              </label>
              <input
                type="number"
                min={1}
                max={villa.max_guests}
                className="border px-2 py-1 rounded max-w-[80px]"
                value={bookingWidget.num_guests}
                onChange={(e) =>
                  setBookingWidget((w) => ({
                    ...w,
                    num_guests: Math.max(
                      1,
                      Math.min(villa.max_guests, Number(e.target.value))
                    ),
                  }))
                }
              />
            </div>
            {/* Booking preview */}
            <div className="mb-3">
              {bookingPreviewLoading ? (
                <div>Finding available dates...</div>
              ) : bookingWidget.checkin_date && bookingWidget.checkout_date ? (
                bookingPreview && bookingPreview.available ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>Nightly:</span>
                      <span>
                        {formatCurrency(
                          bookingPreview.price_summary?.nightly_price
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>Cleaning fee:</span>
                      <span>
                        {formatCurrency(
                          bookingPreview.price_summary?.cleaning_fee
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>Service fee:</span>
                      <span>
                        {formatCurrency(
                          bookingPreview.price_summary?.service_fee
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>Taxes:</span>
                      <span>
                        {formatCurrency(
                          bookingPreview.price_summary?.taxes
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-800 border-t mt-2 pt-2">
                      <span>Total:</span>
                      <span>
                        {formatCurrency(
                          bookingPreview.price_summary?.total_price
                        )}
                      </span>
                    </div>
                  </div>
                ) : bookingPreview && !bookingPreview.available ? (
                  <div className="text-red-600 text-sm font-semibold mt-2">
                    Selected dates are unavailable.
                  </div>
                ) : null
              ) : (
                <div className="text-gray-500">Select dates to see price.</div>
              )}
            </div>
            {/* CTA Booking */}
            {is_authenticated ? (
              <button
                className={
                  "w-full py-2 mt-2 rounded font-bold transition " +
                  "bg-blue-600 text-white hover:bg-blue-700"
                }
                disabled={
                  !bookingWidget.checkin_date ||
                  !bookingWidget.checkout_date ||
                  !bookingWidget.num_guests ||
                  !bookingPreview ||
                  !bookingPreview.available
                }
                onClick={() => {
                  // Go to booking flow
                  navigate(
                    `/booking/start?villa_id=${villa_id}` +
                      `&checkin_date=${bookingWidget.checkin_date}` +
                      `&checkout_date=${bookingWidget.checkout_date}` +
                      `&num_guests=${bookingWidget.num_guests}`
                  );
                }}
              >
                {villa.is_instant_book ? "Book Now" : "Request to Book"}
              </button>
            ) : (
              <Link
                to="/guest/login"
                className="w-full block py-2 mt-2 rounded font-bold bg-blue-500 text-white hover:bg-blue-700 text-center"
              >
                Login to Book
              </Link>
            )}
            {/* Contact Host */}
            <button
              className="w-full mt-4 py-2 px-4 rounded font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 border"
              onClick={() => {
                if (!is_authenticated) {
                  window.alert(
                    "Please sign in to contact the host."
                  );
                  return;
                }
                setContactHostModalOpen(true);
              }}
            >
              Contact Host
            </button>
          </div>
        </div>
      </div>
      {/* --- Wishlist Modal/Popover --- */}
      {saveToWishlistOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setSaveToWishlistOpen(false)}
              className="absolute top-2 right-2 p-1 rounded hover:bg-gray-200"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="font-bold text-lg mb-2">Save to Wishlist</div>
            {wishlistsLoading ? (
              <div>Loading your wishlists...</div>
            ) : userWishlists.length === 0 ? (
              <div>
                You don't have any wishlists yet. <br />
                <Link
                  to="/guest/wishlists"
                  className="text-blue-600 underline"
                  onClick={() => setSaveToWishlistOpen(false)}
                >
                  Create your first Wishlist
                </Link>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (selectedWishlistId) {
                    addToWishlistMutation.mutate({
                      wishlist_id: selectedWishlistId,
                      villa_id,
                    });
                  }
                }}
              >
                <div className="mb-2">
                  <label
                    htmlFor="select-wishlist"
                    className="text-sm font-semibold"
                  >
                    Choose:
                  </label>
                  <select
                    id="select-wishlist"
                    className="w-full text-sm border rounded py-1 mt-1"
                    value={selectedWishlistId || ""}
                    onChange={(e) =>
                      setSelectedWishlistId(e.target.value)
                    }
                  >
                    <option value="" disabled>
                      Select a wishlist
                    </option>
                    {userWishlists.map((wl) => (
                      <option value={String(wl.wishlist_id)} key={String(wl.wishlist_id)}>
                        {wl.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold mt-2"
                  disabled={!selectedWishlistId}
                >
                  {addToWishlistMutation.isLoading
                    ? "Saving..."
                    : "Add to Wishlist"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- Contact Host Modal --- */}
      {contactHostModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setContactHostModalOpen(false)}
              className="absolute top-2 right-2 p-1 rounded hover:bg-gray-200"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="font-bold text-lg mb-2">Contact Host</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                contactHostMutation.mutate({ content: contactHostMessage });
              }}
            >
              <textarea
                className="w-full border rounded px-2 py-1 min-h-[80px]"
                value={contactHostMessage}
                onChange={(e) => setContactHostMessage(e.target.value)}
                maxLength={2048}
                placeholder="Type your message for the host..."
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold mt-2"
                disabled={
                  !contactHostMessage || contactHostMutation.isLoading
                }
              >
                {contactHostMutation.isLoading ? "Sending..." : "Send"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_VillaDetails;