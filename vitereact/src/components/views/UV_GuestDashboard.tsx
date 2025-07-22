import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/main";
import { z } from "zod";

// --------- Types from shared zod schemas (@schema) ---------
import {
  userSchema,
  bookingSchema,
  villaWishlistSchema,
  messageThreadSchema,
  userReviewSchema,
  type User,
  type Booking,
  type VillaWishlist,
  type MessageThread,
  type UserReview
} from "@schema";

// ----------------------------------------------------------

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// ---- API QUERY FUNCTIONS ----

const fetchProfile = async (token: string): Promise<User> => {
  const { data } = await axios.get(`${API_BASE_URL}/account/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return userSchema.parse(data);
};

const fetchMyTrips = async (token: string): Promise<{
  upcoming: Booking[];
  past: Booking[];
  cancelled: Booking[];
}> => {
  const { data } = await axios.get(`${API_BASE_URL}/account/my_trips`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return {
    upcoming: Array.isArray(data.upcoming) ? data.upcoming.map((b: any) => bookingSchema.parse({ ...b, booking_id: Number(b.booking_id), villa_id: Number(b.villa_id), guest_user_id: Number(b.guest_user_id), host_user_id: Number(b.host_user_id) })) : [],
    past: Array.isArray(data.past) ? data.past.map((b: any) => bookingSchema.parse({ ...b, booking_id: Number(b.booking_id), villa_id: Number(b.villa_id), guest_user_id: Number(b.guest_user_id), host_user_id: Number(b.host_user_id) })) : [],
    cancelled: Array.isArray(data.cancelled) ? data.cancelled.map((b: any) => bookingSchema.parse({ ...b, booking_id: Number(b.booking_id), villa_id: Number(b.villa_id), guest_user_id: Number(b.guest_user_id), host_user_id: Number(b.host_user_id) })) : []
  };
};

const fetchWishlists = async (token: string): Promise<VillaWishlist[]> => {
  const { data } = await axios.get(`${API_BASE_URL}/account/wishlists`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.map((wl: any) => villaWishlistSchema.parse({ ...wl, wishlist_id: Number(wl.wishlist_id), villa_ids: Array.isArray(wl.villa_ids) ? wl.villa_ids.map((id: any) => Number(id)) : [] }));
};

const fetchMessages = async (token: string): Promise<MessageThread[]> => {
  const { data } = await axios.get(`${API_BASE_URL}/inbox`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.map((t: any) => messageThreadSchema.parse({ ...t, thread_id: Number(t.thread_id), participant_user_id: Number(t.participant_user_id), villa_id: t.villa_id !== null && t.villa_id !== undefined ? Number(t.villa_id) : null, booking_id: t.booking_id !== null && t.booking_id !== undefined ? Number(t.booking_id) : null }));
};

const fetchMyReviews = async (token: string): Promise<UserReview[]> => {
  const { data } = await axios.get(`${API_BASE_URL}/account/my_reviews`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.map((r: any) => userReviewSchema.parse({ ...r, review_id: Number(r.review_id), booking_id: Number(r.booking_id), villa_id: Number(r.villa_id), host_user_id: Number(r.host_user_id), guest_user_id: Number(r.guest_user_id) }));
};

// ---- Error Boundary ----

class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full text-center py-10 text-red-600">
          <div className="mb-2 font-semibold text-lg">An error occurred loading this section.</div>
          <div className="mb-4 text-xs text-gray-400">{String(this.state.error?.message || this.state.error)}</div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---- UTILS ----

const fmtDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const bookingStatusLabel = (st: string) => {
  switch (st) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "requested":
      return "Requested";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    case "modified":
      return "Modified";
    default:
      return st.charAt(0).toUpperCase() + st.slice(1);
  }
};

// ---- MAIN COMPONENT ----

const TABS = [
  { id: "my_trips", label: "My Trips" },
  { id: "wishlists", label: "Wishlists" },
  { id: "messages", label: "Inbox" },
  { id: "my_reviews", label: "Review History" }
] as const;

type TabId = typeof TABS[number]["id"];

const UV_GuestDashboard: React.FC = () => {
  const navigate = useNavigate();
  const token = useAppStore((s) => s.user_session.token);
  const is_authenticated = useAppStore((s) => s.user_session.is_authenticated);
  const display_name = useAppStore((s) => s.user_session.display_name);
  const profile_photo_url = useAppStore((s) => s.user_session.profile_photo_url);
  const unread_notification_count = useAppStore(
    (s) => (s.notifications ? s.notifications.unread_count : 0)
  );
  const unread_message_count = useAppStore(
    (s) => s.user_session.unread_message_count
  );

  const [selectedTab, setSelectedTab] = useState<TabId>("my_trips");

  useEffect(() => {
    if (!is_authenticated) {
      navigate("/guest/login");
    }
  }, [is_authenticated, navigate]);

  const {
    data: profile,
    isLoading: loadingProfile,
    isError: errorProfile,
    refetch: refetchProfile
  } = useQuery<User, Error>(
    ["guest_dashboard", "profile"],
    () => (token ? fetchProfile(token) : Promise.reject("No token")),
    {
      enabled: !!token,
      retry: 1,
      staleTime: 60 * 1000
    }
  );

  const {
    data: myTrips,
    isLoading: loadingTrips,
    isError: errorTrips,
    refetch: refetchTrips
  } = useQuery<{ upcoming: Booking[]; past: Booking[]; cancelled: Booking[] }, Error>(
    ["guest_dashboard", "my_trips"],
    () => (token ? fetchMyTrips(token) : Promise.reject("No token")),
    {
      enabled: selectedTab === "my_trips" && !!token
    }
  );

  const {
    data: wishlists,
    isLoading: loadingWishlists,
    isError: errorWishlists,
    refetch: refetchWishlists
  } = useQuery<VillaWishlist[], Error>(
    ["guest_dashboard", "wishlists"],
    () => (token ? fetchWishlists(token) : Promise.reject("No token")),
    {
      enabled: selectedTab === "wishlists" && !!token
    }
  );

  const {
    data: messages,
    isLoading: loadingMessages,
    isError: errorMessages,
    refetch: refetchMessages
  } = useQuery<MessageThread[], Error>(
    ["guest_dashboard", "messages"],
    () => (token ? fetchMessages(token) : Promise.reject("No token")),
    {
      enabled: selectedTab === "messages" && !!token
    }
  );

  const {
    data: myReviews,
    isLoading: loadingReviews,
    isError: errorReviews,
    refetch: refetchReviews
  } = useQuery<UserReview[], Error>(
    ["guest_dashboard", "my_reviews"],
    () => (token ? fetchMyReviews(token) : Promise.reject("No token")),
    {
      enabled: selectedTab === "my_reviews" && !!token
    }
  );

  const handleEmptyStateAction = useCallback(() => {
    switch (selectedTab) {
      case "my_trips":
        navigate("/search");
        break;
      case "wishlists":
        navigate("/guest/wishlists");
        break;
      case "messages":
        navigate("/search");
        break;
      case "my_reviews":
        navigate("/search");
        break;
      default:
        break;
    }
  }, [selectedTab, navigate]);

  const onEditProfile = useCallback(() => {
    navigate("/guest/profile/edit");
  }, [navigate]);

  const getTabLabel = (tab: TabId) => {
    if (tab === "messages" && unread_message_count > 0) {
      return (
        <>
          Inbox{" "}
          <span className="ml-2 inline-block px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full align-middle">
            {unread_message_count}
          </span>
        </>
      );
    }
    return TABS.find((t) => t.id === tab)?.label || "";
  };

  return (
    <>
      <div className="max-w-3xl mx-auto pt-10 pb-6 px-4">
        <div className="bg-white rounded-lg shadow border border-gray-100 p-6 mb-6 flex items-center gap-5">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {loadingProfile ? (
              <div className="rounded-full bg-gray-200 w-20 h-20 animate-pulse"></div>
            ) : (
              <img
                src={
                  profile?.profile_photo_url ||
                  profile_photo_url ||
                  "https://picsum.photos/seed/unknownuser/80"
                }
                alt={
                  profile?.display_name
                    ? `${profile.display_name}'s avatar`
                    : "Profile"
                }
                className="rounded-full w-20 h-20 object-cover border"
                loading="lazy"
              />
            )}
          </div>
          {/* Profile info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-semibold text-gray-900 truncate">
                {loadingProfile ? (
                  <span className="inline-block bg-gray-200 h-5 w-28 rounded animate-pulse"></span>
                ) : (
                  (profile?.display_name || display_name || "Guest")
                )}
              </div>
              {profile?.is_superhost && (
                <span
                  className="ml-2 px-2 py-0.5 bg-yellow-300 rounded text-sm font-semibold text-yellow-900"
                  title="Superhost"
                >
                  ★ Superhost
                </span>
              )}
            </div>
            <div className="text-gray-600 mt-1 text-sm truncate">
              {loadingProfile ? (
                <span className="inline-block bg-gray-200 h-4 w-32 rounded animate-pulse"></span>
              ) : (
                profile?.contact_email || profile?.email || "-"
              )}
            </div>
            {profile?.bio && (
              <div className="max-w-md mt-2 text-xs text-gray-500 whitespace-pre-line">
                {profile.bio}
              </div>
            )}
          </div>
          {/* Edit button */}
          <div>
            <button
              onClick={onEditProfile}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              aria-label="Edit Profile"
              type="button"
            >
              Edit
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="mb-4">
          <div className="flex border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`relative px-4 py-2 text-md focus:outline-none font-medium
                ${
                  selectedTab === tab.id
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500 hover:text-blue-600"
                }
                transition-all duration-150`}
                onClick={() => setSelectedTab(tab.id)}
                aria-selected={selectedTab === tab.id}
                aria-controls={`dashboard-tabpanel-${tab.id}`}
                type="button"
              >
                {getTabLabel(tab.id)}
              </button>
            ))}
          </div>
        </div>
        {/* Tab content */}
        <DashboardErrorBoundary>
          <div className="min-h-[400px]" id={`dashboard-tabpanel-${selectedTab}`}>
            {/* My Trips */}
            {selectedTab === "my_trips" && (
              <>
                {loadingTrips ? (
                  <div className="w-full flex justify-center py-20">
                    <span className="text-lg text-gray-400 animate-pulse">
                      Loading your trips...
                    </span>
                  </div>
                ) : errorTrips ? (
                  <div className="py-10 text-red-600 text-center">
                    <div>Failed to load your bookings.</div>
                    <button
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => refetchTrips()}
                    >
                      Try Again
                    </button>
                  </div>
                ) : !myTrips ||
                  (myTrips.upcoming.length === 0 &&
                    myTrips.past.length === 0 &&
                    myTrips.cancelled.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                    <span className="text-4xl">🌴</span>
                    <div className="font-semibold text-lg">No trips yet!</div>
                    <div className="text-sm mb-1">Start your journey and book a stay.</div>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mt-2"
                      onClick={handleEmptyStateAction}
                    >
                      Browse Villas
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8">
                    {/* Upcoming */}
                    {myTrips.upcoming.length > 0 && (
                      <div>
                        <div className="font-semibold mb-2 text-blue-700">
                          Upcoming Reservations
                        </div>
                        {myTrips.upcoming.map((b) => (
                          <Link
                            to={`/reservation/${String(b.booking_id)}`}
                            key={String(b.booking_id)}
                            className="block border-l-4 border-blue-500 bg-blue-50 hover:bg-blue-100 mb-3 rounded transition flex md:flex-row flex-col items-center justify-between p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-lg text-blue-900 truncate">
                                {fmtDate(b.checkin_date)} – {fmtDate(b.checkout_date)}
                              </div>
                              <div className="text-sm text-gray-600 mt-0.5">
                                Booking for {b.num_guests} {b.num_guests > 1 ? "guests" : "guest"}
                              </div>
                              <div className="text-xs mt-0.5 text-gray-400">
                                Status: {bookingStatusLabel(b.status)}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-semibold text-blue-700">
                                ${b.total_price.toFixed(2)}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {/* Past */}
                    {myTrips.past.length > 0 && (
                      <div>
                        <div className="font-semibold mb-2 text-green-700">
                          Past Stays
                        </div>
                        {myTrips.past.map((b) => (
                          <Link
                            to={`/reservation/${String(b.booking_id)}`}
                            key={String(b.booking_id)}
                            className="block border-l-4 border-green-500 bg-green-50 hover:bg-green-100 mb-3 rounded transition flex md:flex-row flex-col items-center justify-between p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-lg text-green-900 truncate">
                                {fmtDate(b.checkin_date)} – {fmtDate(b.checkout_date)}
                              </div>
                              <div className="text-sm text-gray-600 mt-0.5">
                                {b.num_guests > 1
                                  ? `${b.num_guests} guests`
                                  : "1 guest"}
                              </div>
                              <div className="text-xs mt-0.5 text-gray-400">
                                Status: {bookingStatusLabel(b.status)}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-semibold text-green-700">
                                ${b.total_price.toFixed(2)}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {/* Cancelled */}
                    {myTrips.cancelled.length > 0 && (
                      <div>
                        <div className="font-semibold mb-2 text-gray-700">
                          Cancelled Bookings
                        </div>
                        {myTrips.cancelled.map((b) => (
                          <Link
                            to={`/reservation/${String(b.booking_id)}`}
                            key={String(b.booking_id)}
                            className="block border-l-4 border-gray-400 bg-gray-50 hover:bg-gray-100 mb-3 rounded transition flex md:flex-row flex-col items-center justify-between p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-lg text-gray-800 truncate">
                                {fmtDate(b.checkin_date)} – {fmtDate(b.checkout_date)}
                              </div>
                              <div className="text-sm text-gray-600 mt-0.5">
                                {b.num_guests > 1
                                  ? `${b.num_guests} guests`
                                  : "1 guest"}
                              </div>
                              <div className="text-xs mt-0.5 text-gray-400">
                                Status: {bookingStatusLabel(b.status)}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-semibold text-gray-600">
                                ${b.total_price.toFixed(2)}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {/* Wishlists */}
            {selectedTab === "wishlists" && (
              <>
                {loadingWishlists ? (
                  <div className="w-full flex justify-center py-20">
                    <span className="text-lg text-gray-400 animate-pulse">
                      Loading your wishlists...
                    </span>
                  </div>
                ) : errorWishlists ? (
                  <div className="py-10 text-red-600 text-center">
                    <div>Failed to load your wishlists.</div>
                    <button
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => refetchWishlists()}
                    >
                      Try Again
                    </button>
                  </div>
                ) : !wishlists || wishlists.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                    <span className="text-4xl">💖</span>
                    <div className="font-semibold text-lg">No wishlists yet!</div>
                    <div className="text-sm mb-1">Save your first dream villa.</div>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mt-2"
                      onClick={handleEmptyStateAction}
                    >
                      Manage Wishlists
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {wishlists.map((wl) => (
                      <div
                        key={String(wl.wishlist_id)}
                        className={`relative rounded-lg border ${
                          wl.is_deleted
                            ? "border-gray-300 bg-gray-50 opacity-70"
                            : "border-blue-200 bg-blue-50"
                        } px-5 py-4 flex flex-col`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="font-bold text-blue-900 text-lg truncate">{wl.name}</div>
                          {wl.is_deleted && (
                            <span className="ml-2 px-2 py-0.5 bg-gray-400 text-white text-xs rounded">
                              Deleted
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mb-4">
                          {wl.villa_ids.length} villa{wl.villa_ids.length === 1 ? "" : "s"}
                        </div>
                        <Link
                          to="/guest/wishlists"
                          className="absolute top-3 right-3 text-blue-600 underline text-xs hover:text-blue-800 focus:underline"
                        >
                          Manage &rarr;
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {/* Messages/Inbox */}
            {selectedTab === "messages" && (
              <>
                {loadingMessages ? (
                  <div className="w-full flex justify-center py-20">
                    <span className="text-lg text-gray-400 animate-pulse">
                      Loading your messages...
                    </span>
                  </div>
                ) : errorMessages ? (
                  <div className="py-10 text-red-600 text-center">
                    <div>Failed to load your messages.</div>
                    <button
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => refetchMessages()}
                    >
                      Try Again
                    </button>
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                    <span className="text-4xl">📨</span>
                    <div className="font-semibold text-lg">No messages yet!</div>
                    <div className="text-sm mb-1">No conversations with hosts yet.</div>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mt-2"
                      onClick={handleEmptyStateAction}
                    >
                      Start Exploring
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {messages.map((th) => (
                      <Link
                        to={`/messaging/thread/${String(th.thread_id)}`}
                        key={String(th.thread_id)}
                        className="flex items-center bg-blue-50 hover:bg-blue-100 rounded px-4 py-3 border border-blue-200 transition relative"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-blue-800 truncate leading-5">
                            {th.last_message_preview
                              ? th.last_message_preview
                              : "No messages yet."}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            Last updated: {fmtDate(th.updated_at)}
                          </div>
                        </div>
                        {th.unread_count > 0 && (
                          <span className="ml-3 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full leading-none">
                            {th.unread_count}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
            {/* My Reviews */}
            {selectedTab === "my_reviews" && (
              <>
                {loadingReviews ? (
                  <div className="w-full flex justify-center py-20">
                    <span className="text-lg text-gray-400 animate-pulse">
                      Loading your reviews...
                    </span>
                  </div>
                ) : errorReviews ? (
                  <div className="py-10 text-red-600 text-center">
                    <div>Failed to load your reviews.</div>
                    <button
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => refetchReviews()}
                    >
                      Try Again
                    </button>
                  </div>
                ) : !myReviews || myReviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                    <span className="text-4xl">⭐</span>
                    <div className="font-semibold text-lg">No reviews yet!</div>
                    <div className="text-sm mb-1">Review your stays to help others.</div>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mt-2"
                      onClick={handleEmptyStateAction}
                    >
                      Find a Stay
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {myReviews.map((r) => (
                      <div
                        key={String(r.review_id)}
                        className="border-l-4 border-yellow-500 bg-yellow-50 rounded px-5 py-4 flex flex-col gap-1"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-yellow-700 mr-2">
                            {`Rating: `}
                            <span className="font-bold text-lg">
                              {r.rating}
                              <span className="text-yellow-400 ml-1">★</span>
                            </span>
                          </span>
                          <span className="text-xs text-gray-400">
                            Left on {fmtDate(r.created_at)}
                          </span>
                          {r.is_edited && (
                            <span className="ml-1 px-2 py-0.5 bg-gray-300 text-white text-xs rounded">Edited</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-line">{r.text || <em>No comment</em>}</div>
                        {/* Edit review within 48hr */}
                        {(() => {
                          const now = new Date();
                          const created = new Date(r.created_at);
                          const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
                          if (diffHours <= 48) {
                            return (
                              <div className="mt-1">
                                <Link
                                  to={`/review/edit/${String(r.review_id)}`}
                                  className="text-xs text-blue-600 underline hover:text-blue-800"
                                >
                                  Edit Review
                                </Link>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </DashboardErrorBoundary>
      </div>
    </>
  );
};

export default UV_GuestDashboard;