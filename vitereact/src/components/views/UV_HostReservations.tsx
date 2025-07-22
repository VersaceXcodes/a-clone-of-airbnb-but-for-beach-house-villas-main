import React, { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

// --- zod types from DB:zodschemas:ts ---
import {
  bookingSchema,
  Booking,
} from "@schema";

// Zustand for auth token, user info
import { useAppStore } from "@/store/main";

const RESERVATION_STATUS_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "requested", label: "Requested" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "modified", label: "Modified" },
];

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "text-green-600 bg-green-100",
  pending: "text-yellow-700 bg-yellow-100",
  refunded: "text-indigo-700 bg-indigo-100",
  failed: "text-red-700 bg-red-100",
};

const BOOKING_STATUS_COLORS: Record<string, string> = {
  requested: "text-blue-700 bg-blue-100",
  pending: "text-yellow-800 bg-yellow-100",
  confirmed: "text-green-700 bg-green-100",
  completed: "text-emerald-900 bg-emerald-100",
  rejected: "text-red-700 bg-red-100",
  cancelled: "text-gray-700 bg-gray-200",
  modified: "text-blue-800 bg-blue-50",
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ============= Data Fetchers =============

// Fetch all host reservations (bookings for all host's villas)
const fetchHostReservations = async (token?: string): Promise<Booking[]> => {
  if (!token) throw new Error("Not authenticated");
  const res = await axios.get<Booking[]>(`${API_BASE}/host/reservations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Validate each booking with Zod (for type safety)
  const parsed = z.array(bookingSchema).safeParse(res.data);
  if (!parsed.success) throw new Error("Malformed booking data");
  return parsed.data;
};

// Update status for a booking (approve/reject/cancel)
interface UpdateBookingStatusPayload {
  booking_id: string;
  status: "approved" | "rejected" | "cancelled";
}
const updateBookingStatus = async (
  token: string,
  { booking_id, status }: UpdateBookingStatusPayload
): Promise<Booking> => {
  if (!['approved', 'rejected', 'cancelled'].includes(status)) {
    throw new Error('Status must be approved, rejected, or cancelled');
  }
  const bookingIdNum = typeof booking_id === 'string' && !isNaN(Number(booking_id)) ? Number(booking_id) : booking_id;
  const res = await axios.patch<Booking>(
    `${API_BASE}/host/reservations/${bookingIdNum}/status`,
    { status },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const parsed = bookingSchema.safeParse(res.data);
  if (!parsed.success) throw new Error("Malformed booking data after update");
  return parsed.data;
};

// ============== ErrorBoundary ==============
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("ErrorBoundary caught error", error, errorInfo);
    }
  }
  render() {
    if (this.state.hasError)
      return (
        this.props.fallback ||
        <div className="p-8 text-center text-red-600 font-semibold">
          An error occurred. Please reload page.
        </div>
      );
    return this.props.children;
  }
}

// =========== Main Component =============

const UV_HostReservations: React.FC = () => {
  // ---- Auth token & host check
  const token = useAppStore((state) => state.user_session.token);
  const user_id = useAppStore((state) => state.user_session.user_id);
  const is_authenticated = useAppStore((state) => state.user_session.is_authenticated);
  const is_host = useAppStore((state) => state.user_session.is_host);

  const navigate = useNavigate();
  
  // ========== Local UI State ==========
  const [active_status_filter, set_active_status_filter] = React.useState<string | null>(null);

  // Loading/error states for per-row actions
  const [reservation_action_loading, set_reservation_action_loading] = React.useState<{[booking_id: string]: boolean}>({});
  const [reservation_action_error, set_reservation_action_error] = React.useState<{[booking_id: string]: string | null}>({});
  
  const queryClient = useQueryClient();

  // ========== Data Fetching ===========
  const {
    data: reservations,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Booking[], Error>({
    queryKey: ["host_reservations"],
    queryFn: () => fetchHostReservations(token || undefined),
    enabled: !!token,
    staleTime: 1000 * 60, // 1 minute
  });
  
  // Mutation for updating booking status
  const statusMutation = useMutation<Booking, Error, UpdateBookingStatusPayload>({
    mutationFn: ({ booking_id, status }) =>
      updateBookingStatus(token as string, { booking_id, status }),
    onMutate: ({ booking_id }) => {
      set_reservation_action_loading((prev) => ({ ...prev, [booking_id]: true }));
      set_reservation_action_error((prev) => ({ ...prev, [booking_id]: null }));
    },
    onSuccess: (_updated, { booking_id }) => {
      queryClient.invalidateQueries({ queryKey: ["host_reservations"] });
      set_reservation_action_loading((prev) => ({ ...prev, [booking_id]: false }));
      set_reservation_action_error((prev) => ({ ...prev, [booking_id]: null }));
    },
    onError: (err, { booking_id }) => {
      set_reservation_action_loading((prev) => ({ ...prev, [booking_id]: false }));
      set_reservation_action_error((prev) => ({
        ...prev,
        [booking_id]: err.message || "Failed to update reservation",
      }));
    },
    retry: 1,
  });

  // ========== Filtering and Sorting ===========
  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    if (!active_status_filter) return reservations.slice().sort(dynamicSort("checkin_date", true));
    return reservations
      .filter(r => r.status === active_status_filter)
      .sort(dynamicSort("checkin_date", true));
  }, [reservations, active_status_filter]);
  
  // Helper: Dynamic sort
  function dynamicSort(key: keyof Booking, ascending = true) {
    return function(a: Booking, b: Booking) {
      if (!a[key] || !b[key]) return 0;
      if (typeof a[key] === "string" && typeof b[key] === "string") {
        // check if date
        const aVal =
          key.toLowerCase().includes("date") && !isNaN(Date.parse(a[key] as string))
            ? Date.parse(a[key] as string)
            : a[key] as string;
        const bVal =
          key.toLowerCase().includes("date") && !isNaN(Date.parse(b[key] as string))
            ? Date.parse(b[key] as string)
            : b[key] as string;
        if (aVal > bVal) return ascending ? 1 : -1;
        if (aVal < bVal) return ascending ? -1 : 1;
        return 0;
      }
      if (typeof a[key] === "number" && typeof b[key] === "number") {
        return ascending ? a[key] - b[key] : b[key] - a[key];
      }
      return 0;
    };
  }

  // ========== UI Actions ==========
  function handleUpdateBooking(booking_id: string, status: "approved" | "rejected" | "cancelled") {
    if (!['approved', 'rejected', 'cancelled'].includes(status)) return;
    statusMutation.mutate({ booking_id, status });
  }
  
  // ========== Access Control ==========
  if (!is_authenticated) {
    return (
      <div className="py-24 flex justify-center items-center">
        <div className="shadow border p-8 bg-white rounded">
          <div className="text-lg text-gray-800">You must be logged in to view your reservations.</div>
          <Link
            to="/guest/login"
            className="block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-800 text-center"
          >
            Login as Host
          </Link>
        </div>
      </div>
    );
  }
  if (!is_host) {
    return (
      <div className="py-24 flex justify-center items-center">
        <div className="shadow border p-8 bg-white rounded">
          <div className="text-lg text-gray-800">This page is for hosts only.</div>
          <Link
            to="/"
            className="block mt-4 px-4 py-2 bg-gray-100 text-blue-700 rounded hover:bg-blue-100 text-center"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // ========== Main Render ===========
  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-5 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reservations Manager</h1>
            <p className="text-gray-500 max-w-xl mt-1">
              Review, approve or reject booking requests, and track all reservation activity for your villas.
            </p>
          </div>
          <div className="min-w-[180px] flex flex-col items-end">
            <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter: Status
            </label>
            <select
              id="filter"
              value={active_status_filter ?? ""}
              onChange={e => set_active_status_filter(e.target.value || null)}
              className="rounded border-gray-300 text-sm px-2 py-1"
            >
              {RESERVATION_STATUS_OPTIONS.map(opt => (
                <option key={opt.label} value={opt.value ?? ""}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading/error global */}
        {isLoading && (
          <div className="py-16 flex justify-center text-blue-500 animate-pulse">
            <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Loading reservations...
          </div>
        )}
        {isError && (
          <div className="py-4 mb-4 rounded bg-red-100 border border-red-300 text-red-800 text-center">
            {(error as Error)?.message || "Failed to load reservations."}
            <button
              className="ml-4 inline-block px-2 py-0.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        )}
        {!isLoading && (!filteredReservations || filteredReservations.length === 0) && (
          <div className="p-10 flex flex-col items-center text-gray-500 bg-gray-50 rounded-lg border mt-8">
            <img
              src={`https://picsum.photos/seed/rsvp-${active_status_filter || "all"}/180/100`}
              alt="Empty State"
              className="opacity-40 mb-3 rounded"
            />
            <div className="text-xl">
              No reservations found{active_status_filter ? ` for ${active_status_filter}` : ""}.
            </div>
            <div className="text-gray-400">You will see booking requests and reservations appear here as they are made.</div>
          </div>
        )}

        {/* Reservation List */}
        {filteredReservations && filteredReservations.length > 0 && (
          <div className="overflow-x-auto border rounded-lg bg-white shadow-sm mt-6">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 border-b">
                  <th className="py-2 px-3 text-left">Villa ID</th>
                  <th className="py-2 px-3 text-left">Guest</th>
                  <th className="py-2 px-3 text-left">Check-in</th>
                  <th className="py-2 px-3 text-left">Check-out</th>
                  <th className="py-2 px-3 text-right">Guests</th>
                  <th className="py-2 px-3 text-right">Total, $</th>
                  <th className="py-2 px-3 text-center">Payment</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-center">Actions</th>
                  <th className="py-2 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((r) => {
                  const bookingIdStr = r.booking_id.toString();
                  const villaIdStr = r.villa_id.toString();
                  return (
                    <tr
                      key={bookingIdStr}
                      className="border-b hover:bg-blue-50 transition"
                    >
                      {/* Villa ID (can link to host/villa detail) */}
                      <td className="py-2 px-3 font-semibold text-blue-900">
                        <Link
                          to={`/host/villa/${villaIdStr}`}
                          className="hover:underline"
                          title="View Villa"
                        >
                          {villaIdStr}
                        </Link>
                      </td>
                      {/* Guest User ID, deep link to thread/messages */}
                      <td className="py-2 px-3">
                        <Link
                          to={`/messaging?booking_id=${bookingIdStr}`}
                          className="inline-flex items-center text-blue-700 hover:underline"
                          title="Message Guest"
                        >
                          <span className="font-semibold">Guest #{r.guest_user_id.toString()}</span>
                          <svg className="w-4 h-4 ml-1 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M17 8l4 4m0 0l-4 4m4-4H3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </Link>
                      </td>
                      {/* Dates */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span>{r.checkin_date}</span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span>{r.checkout_date}</span>
                      </td>
                      {/* Num guests */}
                      <td className="py-2 px-3 text-right">
                        {r.num_guests}
                      </td>
                      {/* Total */}
                      <td className="py-2 px-3 text-right font-semibold text-gray-700">
                        {r.total_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {/* Payment Status */}
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${PAYMENT_STATUS_COLORS[r.payment_status] || "bg-gray-100 text-gray-700"}`}>
                          {r.payment_status}
                        </span>
                      </td>
                      {/* Booking Status */}
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-1 text-xs font-bold rounded ${BOOKING_STATUS_COLORS[r.status] || "bg-gray-200 text-gray-700"}`}>
                          {r.status}
                        </span>
                      </td>
                      {/* Actions: quick action depending on status */}
                      <td className="py-2 px-3 text-center">
                        {(r.status === "requested" || r.status === "pending") && (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              className={`w-24 px-2 py-1 rounded font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60`}
                              disabled={!!reservation_action_loading[bookingIdStr]}
                              onClick={() => handleUpdateBooking(r.booking_id, "approved")}
                            >
                              {reservation_action_loading[bookingIdStr] ? (
                                <span className="animate-spin mr-1">⏳</span>
                              ) : null}
                              Approve
                            </button>
                            <button
                              type="button"
                              className={`w-24 px-2 py-1 rounded font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60`}
                              disabled={!!reservation_action_loading[bookingIdStr]}
                              onClick={() => handleUpdateBooking(r.booking_id, "rejected")}
                            >
                              {reservation_action_loading[bookingIdStr] ? (
                                <span className="animate-spin mr-1">⏳</span>
                              ) : null}
                              Reject
                            </button>
                          </div>
                        )}
                        {(r.status === "confirmed" || r.status === "completed") && (
                          <button
                            type="button"
                            className={`w-24 px-2 py-1 rounded font-semibold text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-50`}
                            disabled={!!reservation_action_loading[bookingIdStr]}
                            onClick={() => handleUpdateBooking(r.booking_id, "cancelled")}
                          >
                            {reservation_action_loading[bookingIdStr] ? (
                              <span className="animate-spin mr-1">⏳</span>
                            ) : null}
                            Cancel
                          </button>
                        )}
                        {/* Nothing to do for cancelled/rejected/etc. */}
                        {reservation_action_error[bookingIdStr] && (
                          <span className="block mt-1 text-xs text-red-600 whitespace-pre">
                            {reservation_action_error[bookingIdStr]}
                          </span>
                        )}
                      </td>
                      {/* Link to detail */}
                      <td className="py-2 px-1 text-center">
                        <Link
                          to={`/host/reservation/${bookingIdStr}`}
                          className="inline-block text-blue-700 hover:underline px-1 py-0.5"
                          title="View reservation details"
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
        )}
      </div>
    </ErrorBoundary>
  );
};

export default UV_HostReservations;