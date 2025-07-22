import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/main";
import axios from "axios";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";

// --- Import zod types for type safety
import {
  Villa,
  Booking,
  UserReview,
  GuestReview,
  MessageThread,
  VillaCalendar,
} from "@schema";

// --- API Base URL helper
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Utils for formatting
function formatCurrency(amount: number) {
  return typeof amount === "number"
    ? amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "$0";
}
function formatDate(date: string) {
  if (!date) return "-";
  const parsed = new Date(date);
  return isNaN(parsed.valueOf()) ? "-" : parsed.toLocaleDateString();
}
function statusLabel(status: string) {
  switch (status) {
    case "confirmed": return <span className="text-green-700 font-semibold">Confirmed</span>;
    case "pending": return <span className="text-yellow-600 font-semibold">Pending</span>;
    case "requested": return <span className="text-yellow-500 font-semibold">Requested</span>;
    case "cancelled": return <span className="text-gray-400 font-semibold">Cancelled</span>;
    case "rejected": return <span className="text-red-600 font-semibold">Rejected</span>;
    case "completed": return <span className="text-blue-700 font-semibold">Completed</span>;
    default: return <span>{status}</span>;
  }
}

// ========================
// Host Dashboard Component
// ========================

const UV_HostDashboard: React.FC = () => {
  // ---- Global Store State ----
  const user_session = useAppStore((s) => s.user_session);
  const set_host_dashboard_state = useAppStore((s) => s.set_host_dashboard_state);
  const host_dashboard_state = useAppStore((s) => s.host_dashboard_state);

  // ---- Local State ---
  const [active_tab, set_active_tab] = useState<
    "my_villas" | "reservations" | "calendar" | "inbox" | "reviews" | "earnings" | "profile"
  >("my_villas");
  const [selected_villa_for_calendar, set_selected_villa_for_calendar] = useState<string | null>(null);

  // ---- Navigation ----
  const navigate = useNavigate();

  // ---- React Query Setup ----
  const token = user_session.token;
  const queryClient = useQueryClient();

  // --- Data Fetching (React Query) ---

  // 1. Villas
  const villasQuery = useQuery<Villa[]>({
    queryKey: ["host_villas"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/host/villas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataArr = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.results)
        ? res.data.results
        : [];
      return dataArr.map((villa: any) => ({
        ...villa,
        villa_id: villa.villa_id.toString(),
        main_photo_url: villa.main_photo_url || "",
      }));
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 2,
  });

  // 2. Reservations/Bookings
  const reservationsQuery = useQuery<Booking[]>({
    queryKey: ["host_reservations"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/host/reservations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataArr = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.results)
        ? res.data.results
        : [];
      return dataArr.map((b: any) => ({
        ...b,
        booking_id: b.booking_id.toString(),
        villa_id: b.villa_id.toString(),
      }));
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 2,
  });

  // 3. Inbox Threads
  const inboxThreadsQuery = useQuery<MessageThread[]>({
    queryKey: ["inbox_threads"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataArr = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.results)
        ? res.data.results
        : [];
      return dataArr.map((thread: any) => ({
        ...thread,
        thread_id: thread.thread_id.toString(),
        participant_user_id: thread.participant_user_id?.toString(),
        villa_id: thread.villa_id ? thread.villa_id.toString() : null,
        booking_id: thread.booking_id ? thread.booking_id.toString() : null,
      }));
    },
    enabled: !!token && active_tab === "inbox",
    staleTime: 1000 * 30,
  });

  // 4. Reviews (received/reviews_given)
  // We need all reviews received BY HOST for all villas, and guest reviews host LEFT (by all villas)
  const reviewsQueries = useQueries({
    queries: (villasQuery.data || []).map((villa) => ({
      queryKey: ["villa_reviews", villa.villa_id],
      queryFn: async () => {
        try {
          const res = await axios.get(
            `${API_BASE}/villas/${villa.villa_id}/reviews?page=1`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          return (res.data && Array.isArray(res.data.reviews)) ? res.data.reviews : [];
        } catch (err) {
          return [];
        }
      },
      enabled: !!token && active_tab === "reviews",
      staleTime: 1000 * 60,
    })),
  });
  // Reviews GIVEN (host's guest-reviews by villa)
  const guestReviewsQueries = useQueries({
    queries: (villasQuery.data || []).map((villa) => ({
      queryKey: ["villa_guest_reviews", villa.villa_id],
      queryFn: async () => {
        try {
          const res = await axios.get(
            `${API_BASE}/host/villas/${villa.villa_id}/guest-reviews`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          return Array.isArray(res.data) ? res.data : [];
        } catch (err) {
          return [];
        }
      },
      enabled: !!token && active_tab === "reviews",
      staleTime: 1000 * 60,
    })),
  });

  // 5. Superhost status
  const superhostQuery = useQuery<{ is_superhost: boolean }>({
    queryKey: ["superhost_status"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/account/superhost`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });

  // 6. Calendar (per-villa fetch on demand)
  const [calendar_data, set_calendar_data] = useState<Record<string, VillaCalendar[]>>({});
  const [calendar_loading, set_calendar_loading] = useState<Record<string, boolean>>({});
  const [calendar_error, set_calendar_error] = useState<Record<string, string>>({});
  const fetchCalendar = useCallback(
    async (villa_id: string) => {
      set_calendar_loading((old) => ({ ...old, [villa_id]: true }));
      set_calendar_error((old) => ({ ...old, [villa_id]: "" }));
      try {
        const res = await axios.get(`${API_BASE}/villa/${villa_id}/calendar`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        set_calendar_data((old) => ({
          ...old,
          [villa_id]: Array.isArray(res.data) ? res.data : [],
        }));
        set_calendar_loading((old) => ({ ...old, [villa_id]: false }));
      } catch (err: any) {
        set_calendar_loading((old) => ({ ...old, [villa_id]: false }));
        set_calendar_error((old) => ({
          ...old,
          [villa_id]: err?.response?.data?.error || err?.message || "Failed to fetch calendar.",
        }));
      }
    },
    [token]
  );

  // --- Revenue Calculation
  const calcRevenueSummary = (
    reservations: Booking[] | undefined
  ): { total: number; upcoming: number } => {
    if (!reservations) return { total: 0, upcoming: 0 };
    let total = 0, upcoming = 0;
    const now = new Date();
    reservations.forEach((b) => {
      if (["confirmed", "completed"].includes(b.status)) {
        total += b.total_price;
        if (new Date(b.checkin_date) >= now) {
          upcoming += b.total_price;
        }
      }
    });
    return { total, upcoming };
  };

  // --- Sync data to store on success (for cross-view/global state consistency)
  useEffect(() => {
    if (villasQuery.data) {
      set_host_dashboard_state({
        villas: villasQuery.data.map((v) => ({
          villa_id: v.villa_id,
          title: v.title,
          published_at: v.published_at || null,
          is_active: v.is_active,
          main_photo_url: v.main_photo_url || "",
          pending_reservations: 0, // will be updated below
          upcoming_reservations: 0,
        })),
      });
    } else {
      set_host_dashboard_state({ villas: [] });
    }
  }, [villasQuery.data, set_host_dashboard_state]);

  useEffect(() => {
    if (
      reservationsQuery.data &&
      Array.isArray(host_dashboard_state.villas) &&
      host_dashboard_state.villas.length > 0
    ) {
      // Map pending/upcoming to each villa
      const villasCopy = host_dashboard_state.villas.map((v) => ({
        ...v,
        pending_reservations: reservationsQuery.data!.filter(
          (b) => b.villa_id === v.villa_id && ["pending", "requested"].includes(b.status)
        ).length,
        upcoming_reservations: reservationsQuery.data!.filter(
          (b) =>
            b.villa_id === v.villa_id &&
            ["confirmed"].includes(b.status) &&
            new Date(b.checkin_date) >= new Date()
        ).length,
      }));
      set_host_dashboard_state({
        villas: villasCopy,
        reservations: reservationsQuery.data,
        revenue_summary: calcRevenueSummary(reservationsQuery.data),
      });
    } else if (!reservationsQuery.data) {
      set_host_dashboard_state({
        reservations: [],
        revenue_summary: { total: 0, upcoming: 0 },
      });
    }
  }, [reservationsQuery.data, set_host_dashboard_state, host_dashboard_state.villas]);

  // --- Aggregate Reviews for reviews tab
  const [reviews_received, set_reviews_received] = useState<UserReview[]>([]);
  const [reviews_given, set_reviews_given] = useState<GuestReview[]>([]);
  useEffect(() => {
    if (active_tab === "reviews") {
      // Aggregate for reviews_received
      const allReceived: UserReview[] = [];
      reviewsQueries.forEach((q) => {
        if (Array.isArray(q.data)) {
          allReceived.push(...q.data);
        }
      });
      set_reviews_received(allReceived);
      // Aggregate for reviews_given
      const allGiven: GuestReview[] = [];
      guestReviewsQueries.forEach((q) => {
        if (Array.isArray(q.data)) {
          allGiven.push(...q.data);
        }
      });
      set_reviews_given(allGiven);
    }
  }, [reviewsQueries, guestReviewsQueries, active_tab]);

  // --- Superhost badge
  const is_superhost =
    typeof superhostQuery.data?.is_superhost !== "undefined"
      ? superhostQuery.data.is_superhost
      : user_session.is_superhost;

  // --- Guard: If not a host, redirect to homepage or login
  useEffect(() => {
    if (!user_session.is_authenticated || !user_session.is_host || !token) {
      navigate("/guest/login", { replace: true });
    }
  }, [user_session, token, navigate]);

  // --- UI: Loading/error
  const isLoading =
    villasQuery.isLoading ||
    reservationsQuery.isLoading ||
    (active_tab === "reviews" &&
      (reviewsQueries.some((q) => q.isLoading) || guestReviewsQueries.some((q) => q.isLoading))) ||
    (active_tab === "inbox" && inboxThreadsQuery.isLoading) ||
    superhostQuery.isLoading;

  const error =
    villasQuery.error ||
    reservationsQuery.error ||
    (active_tab === "reviews" &&
      ((reviewsQueries.find((q) => q.error) || guestReviewsQueries.find((q) => q.error))?.error)) ||
    (active_tab === "inbox" && inboxThreadsQuery.error) ||
    superhostQuery.error;

  // --- List Your Villa / onboarding flow (empty state)
  const hasVillas = (villasQuery.data?.length || 0) > 0;

  // --- Tabs ---
  const TABS: { id: typeof active_tab; label: string }[] = [
    { id: "my_villas", label: "My Villas" },
    { id: "reservations", label: "Reservations" },
    { id: "calendar", label: "Calendar Management" },
    { id: "inbox", label: "Inbox" },
    { id: "reviews", label: "Reviews" },
    { id: "earnings", label: "Earnings" },
    { id: "profile", label: "Profile Edit" },
  ];

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Heading & Host Info */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <img
              src={
                user_session.profile_photo_url ||
                "https://picsum.photos/seed/profile/64"
              }
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover border"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  Welcome, {user_session.display_name || "Host"}
                </h1>
                {is_superhost && (
                  <span
                    title="Superhost"
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-200 border border-yellow-400 text-yellow-800 rounded text-xs font-bold"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      className="w-4 h-4 text-yellow-500"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 16.7l-6.16 3.84 1.66-7.14L2 8.76l7.19-.61L12 1.75l2.81 6.4 7.19.61-5.5 4.64 1.66 7.14z" />
                    </svg>
                    Superhost
                  </span>
                )}
              </div>
              <p className="text-gray-500">
                Manage your properties, bookings, and messages
              </p>
            </div>
          </div>
          {/* Revenue summary */}
          <div className="flex flex-col items-end">
            <div className="text-sm text-gray-400">Total Earnings</div>
            <div className="text-xl font-bold">
              {formatCurrency(host_dashboard_state.revenue_summary?.total || 0)}
            </div>
            <div className="text-xs text-gray-400">
              Upcoming:{" "}
              {formatCurrency(host_dashboard_state.revenue_summary?.upcoming || 0)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6 flex gap-4 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => set_active_tab(tab.id)}
              className={`px-4 py-2 text-sm font-medium ${
                active_tab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-gray-600 hover:text-blue-600"
              } bg-transparent focus:outline-none transition`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <span className="text-gray-500 animate-pulse">Loading...</span>
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-red-100 text-red-800 border border-red-300 px-4 py-3 rounded mb-4">
            Error loading dashboard data. Please try refreshing.<br />
            <span className="text-xs break-all">{(error as any)?.message || String(error)}</span>
          </div>
        )}

        {/* --- IF NO VILLAS: Show onboarding/CTA --- */}
        {!isLoading && !hasVillas && active_tab === "my_villas" && (
          <div className="flex flex-col items-center justify-center py-16 bg-blue-50 rounded-lg border border-blue-100">
            <img
              src="https://picsum.photos/seed/hostonboarding/160/80"
              className="rounded shadow mb-4"
              alt="List your villa"
              width={160}
              height={80}
            />
            <div className="text-2xl font-semibold text-blue-800 mb-2">
              You have no villas listed.
            </div>
            <div className="text-gray-500 mb-6">
              Get started by listing your first villa and start earning.
            </div>
            <Link
              to="/host/onboarding"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-6 py-2 transition"
            >
              List Your Villa
            </Link>
          </div>
        )}

        {!isLoading && hasVillas && (
          <>
            {/* --- MY VILLAS TAB --- */}
            {active_tab === "my_villas" && (
              <div>
                <div className="flex justify-end mb-6">
                  <Link
                    to="/host/onboarding"
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 font-medium"
                  >
                    + Add Villa
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(host_dashboard_state.villas || []).map((villa) => (
                    <div
                      key={villa.villa_id}
                      className="bg-white border border-gray-200 rounded-lg shadow p-5 flex flex-col"
                    >
                      <div className="relative mb-4">
                        <img
                          src={
                            villa.main_photo_url ||
                            `https://picsum.photos/seed/villa${villa.villa_id}/400/220`
                          }
                          alt={villa.title}
                          className="w-full h-40 object-cover rounded mb-2"
                        />
                        {!villa.is_active && (
                          <span className="absolute top-2 left-2 bg-yellow-200 text-yellow-800 px-2 py-1 text-xs rounded font-bold z-10">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">{villa.title}</h3>
                        <div className="text-sm text-gray-400 mb-2">
                          Listed:{" "}
                          {villa.published_at
                            ? formatDate(villa.published_at)
                            : <span className="text-red-500">Unpublished</span>}
                        </div>
                        <div className="flex justify-between mb-2 text-xs text-gray-600">
                          <span>
                            Pending:{" "}
                            <strong>{villa.pending_reservations}</strong>
                          </span>
                          <span>
                            Upcoming:{" "}
                            <strong>{villa.upcoming_reservations}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Link
                          to={`/host/villa/${villa.villa_id}`}
                          className="flex-1 text-center bg-gray-100 hover:bg-gray-200 rounded px-3 py-2 font-medium text-gray-700 border border-gray-200"
                          title="View/Manage Villa"
                        >
                          Manage
                        </Link>
                        <Link
                          to={`/host/villa/${villa.villa_id}/edit`}
                          className="flex-1 text-center bg-blue-50 hover:bg-blue-100 rounded px-3 py-2 font-medium text-blue-700 border border-blue-200"
                          title="Edit Villa"
                        >
                          Edit
                        </Link>
                        <button
                          className="flex-1 text-center bg-yellow-50 hover:bg-yellow-100 rounded px-3 py-2 font-medium text-yellow-800 border border-yellow-200"
                          title="(Not implemented) Remove/Unlist"
                          disabled
                        >
                          Unlist
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- RESERVATIONS TAB --- */}
            {active_tab === "reservations" && (
              <div>
                <h2 className="text-xl font-semibold mb-4">All Reservations</h2>
                {Array.isArray(host_dashboard_state.reservations) &&
                  host_dashboard_state.reservations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left">Villa</th>
                          <th className="px-4 py-2 text-left">Guest</th>
                          <th className="px-4 py-2 text-left">Check-In</th>
                          <th className="px-4 py-2 text-left">Check-Out</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left">Total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {host_dashboard_state.reservations.map((r) => {
                          const villa = host_dashboard_state.villas.find(
                            (v) => v.villa_id === r.villa_id
                          );
                          return (
                            <tr
                              key={r.booking_id}
                              className="border-t border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-4 py-2">{villa?.title || "Villa #" + r.villa_id}</td>
                              <td className="px-4 py-2">
                                <span className="text-gray-600">ID: {r.guest_user_id}</span>
                              </td>
                              <td className="px-4 py-2">{formatDate(r.checkin_date)}</td>
                              <td className="px-4 py-2">{formatDate(r.checkout_date)}</td>
                              <td className="px-4 py-2">{statusLabel(r.status)}</td>
                              <td className="px-4 py-2">{formatCurrency(r.total_price)}</td>
                              <td className="px-4 py-2">
                                <Link
                                  to={`/host/reservation/${r.booking_id}`}
                                  className="text-blue-600 hover:underline text-sm"
                                >
                                  Details
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded p-8 text-center text-gray-500">
                    No reservations yet. Once you receive bookings, they'll show up here.
                  </div>
                )}
              </div>
            )}

            {/* --- CALENDAR MANAGEMENT TAB --- */}
            {active_tab === "calendar" && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Calendar Management</h2>
                <div className="flex flex-wrap gap-3 mb-5">
                  {(host_dashboard_state.villas || []).map((villa) => (
                    <button
                      key={villa.villa_id}
                      onClick={() => {
                        set_selected_villa_for_calendar(villa.villa_id);
                        if (!calendar_data[villa.villa_id] && !calendar_loading[villa.villa_id]) {
                          fetchCalendar(villa.villa_id);
                        }
                      }}
                      className={`px-3 py-1 rounded border ${
                        selected_villa_for_calendar === villa.villa_id
                          ? "bg-blue-100 border-blue-400 text-blue-900 font-semibold"
                          : "bg-gray-100 border-gray-200 text-gray-700"
                      }`}
                    >
                      {villa.title}
                    </button>
                  ))}
                </div>
                {selected_villa_for_calendar && (
                  <div>
                    <h3 className="font-medium text-lg mb-2">
                      Calendar for {host_dashboard_state.villas.find((v) => v.villa_id === selected_villa_for_calendar)?.title}
                    </h3>
                    {calendar_loading[selected_villa_for_calendar] && (
                      <div className="text-gray-400 py-6">Loading calendar...</div>
                    )}
                    {calendar_error[selected_villa_for_calendar] && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-2">{calendar_error[selected_villa_for_calendar]}</div>
                    )}
                    {!calendar_loading[selected_villa_for_calendar] && !calendar_error[selected_villa_for_calendar] && (!calendar_data[selected_villa_for_calendar] ? (
                      <div className="text-gray-400 py-6">No calendar data available.</div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg p-4 bg-white max-w-2xl">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {calendar_data[selected_villa_for_calendar] && calendar_data[selected_villa_for_calendar].length > 0 ? (
                            calendar_data[selected_villa_for_calendar].map((day) => (
                              <div
                                key={day.date}
                                className={`px-2 py-3 border rounded text-center
                                ${
                                  day.is_available
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : "bg-gray-100 border-gray-200 text-gray-400 line-through"
                                }`}
                              >
                                <div className="font-mono">{formatDate(day.date)}</div>
                                {day.is_available ? "Available" : "Blocked"}
                                {day.reason && (
                                  <div className="text-gray-400 text-xs mt-1">
                                    {day.reason}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="col-span-4 text-center text-gray-400 py-6">
                              No calendar data available.
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500 text-right">
                          (Calendar editing coming soon)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!selected_villa_for_calendar && (
                  <div className="bg-gray-50 border border-gray-100 rounded p-8 text-center text-gray-500">
                    Select a villa to manage its availability calendar.
                  </div>
                )}
              </div>
            )}

            {/* --- INBOX TAB --- */}
            {active_tab === "inbox" && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Messaging Inbox</h2>
                {Array.isArray(inboxThreadsQuery.data) && inboxThreadsQuery.data.length > 0 ? (
                  <div className="divide-y border rounded bg-white overflow-hidden">
                    {inboxThreadsQuery.data.map((thread) => (
                      <Link
                        to={`/messaging/thread/${thread.thread_id}`}
                        key={thread.thread_id}
                        className="block hover:bg-blue-50 p-4 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold mb-1">Thread #{thread.thread_id}</div>
                            <div className="text-gray-600 text-sm">
                              Villa:{" "}
                              {host_dashboard_state.villas.find((v) => v.villa_id === thread.villa_id)?.title ||
                                (thread.villa_id ? `#${thread.villa_id}` : "-")}
                              {thread.booking_id && (
                                <span>
                                  {" "}
                                  (Booking #{thread.booking_id})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">
                              Updated: {formatDate(thread.updated_at as any)}
                            </div>
                            <div className="text-gray-700 mt-1 truncate">
                              {thread.last_message_preview || "(No messages)"}
                            </div>
                          </div>
                          <div className="flex flex-col items-center">
                            {thread.unread_count > 0 && (
                              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5 font-semibold">
                                {thread.unread_count} new
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded p-8 text-center text-gray-500">
                    No messages yet. New guest inquiries will appear here.
                  </div>
                )}
              </div>
            )}

            {/* --- REVIEWS TAB --- */}
            {active_tab === "reviews" && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Reviews</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Reviews RECEIVED */}
                  <div>
                    <div className="font-semibold text-gray-700 mb-2">
                      <span className="mr-1">Reviews Received</span>
                      <span className="bg-gray-200 text-xs px-2 py-0.5 rounded-full">
                        {reviews_received.length}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {reviews_received.length === 0 ? (
                        <div className="bg-gray-50 border border-gray-100 rounded p-6 text-center text-gray-400">
                          No reviews received.
                        </div>
                      ) : (
                        reviews_received.map((r) => {
                          const villa = host_dashboard_state.villas.find(
                            (v) => v.villa_id === r.villa_id
                          );
                          return (
                            <div key={r.review_id} className="border rounded p-3 bg-white">
                              <div className="flex items-center gap-3">
                                <div className="text-yellow-400 text-lg font-bold">{Array(r.rating).fill("★").join("")}<span className="text-gray-300">{Array(5 - r.rating).fill("★").join("")}</span></div>
                                <div>
                                  <span className="font-bold">{villa?.title || "Villa #" + r.villa_id}</span>
                                  <span className="ml-2 text-xs text-gray-400">{formatDate(r.created_at as any)}</span>
                                </div>
                              </div>
                              <div className="mt-2">{r.text || <em className="text-gray-400">No comment left</em>}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  {/* Reviews GIVEN */}
                  <div>
                    <div className="font-semibold text-gray-700 mb-2">
                      <span className="mr-1">Reviews Given</span>
                      <span className="bg-gray-200 text-xs px-2 py-0.5 rounded-full">
                        {reviews_given.length}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {reviews_given.length === 0 ? (
                        <div className="bg-gray-50 border border-gray-100 rounded p-6 text-center text-gray-400">
                          No reviews given.
                        </div>
                      ) : (
                        reviews_given.map((r) => {
                          return (
                            <div key={r.guest_review_id} className="border rounded p-3 bg-white">
                              <div className="flex items-center gap-3">
                                <div className="text-yellow-400 text-lg font-bold">{Array(r.rating).fill("★").join("")}<span className="text-gray-300">{Array(5 - r.rating).fill("★").join("")}</span></div>
                                <div>
                                  <span className="font-bold">Guest #{r.guest_user_id}</span>
                                  <span className="ml-2 text-xs text-gray-400">{formatDate(r.created_at as any)}</span>
                                </div>
                              </div>
                              <div className="mt-2">{r.text || <em className="text-gray-400">No comment left</em>}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- EARNINGS TAB --- */}
            {active_tab === "earnings" && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Earnings Summary</h2>
                <div className="flex flex-wrap gap-4 mb-6">
                  {(host_dashboard_state.villas || []).map((villa) => {
                    const earnings = (host_dashboard_state.reservations || []).filter(
                      (b) => b.villa_id === villa.villa_id && ["confirmed", "completed"].includes(b.status)
                    ).reduce((sum, b) => sum + b.total_price, 0);
                    return (
                      <div key={villa.villa_id} className="p-5 bg-white rounded-lg border border-gray-100 shadow flex-1 min-w-[220px]">
                        <div className="text-gray-600 text-sm mb-1">{villa.title}</div>
                        <div className="text-2xl font-bold">{formatCurrency(earnings)}</div>
                        <div className="text-xs text-gray-400">All time</div>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <div className="text-gray-500 mb-2">
                    <strong>Total earnings:</strong> {formatCurrency(host_dashboard_state.revenue_summary?.total || 0)}
                  </div>
                  <div className="text-gray-400 text-xs">
                    Based on confirmed and completed reservations. <span className="italic">(Simulated payout)</span>
                  </div>
                </div>
              </div>
            )}

            {/* --- PROFILE TAB --- */}
            {active_tab === "profile" && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Edit Profile</h2>
                <div className="p-6 bg-white border border-gray-100 rounded-lg shadow max-w-md">
                  <div className="mb-4 flex gap-3 items-center">
                    <img
                      src={user_session.profile_photo_url || "https://picsum.photos/seed/profile/56"}
                      className="w-14 h-14 rounded-full object-cover border"
                      alt="Profile"
                    />
                    <div>
                      <div className="text-lg font-bold mb-0.5">
                        {user_session.display_name}
                        {is_superhost && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-yellow-100 border border-yellow-200 text-yellow-700 font-semibold">
                            Superhost
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-sm">
                        User #{user_session.user_id}
                      </div>
                    </div>
                  </div>
                  <div className="mb-6">
                    <div className="flex justify-between mb-2">
                      <div className="text-gray-700">Display Name</div>
                      <div className="text-gray-900 font-medium">{user_session.display_name}</div>
                    </div>
                    <div className="flex justify-between mb-2">
                      <div className="text-gray-700">Email</div>
                      <div className="text-gray-900 font-medium">******</div>
                    </div>
                  </div>
                  <Link
                    to="/host/profile/edit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
                  >
                    Edit Profile
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default UV_HostDashboard;