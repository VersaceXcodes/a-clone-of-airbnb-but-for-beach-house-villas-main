import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";
import { bookingSchema, villaSchema, userSchema, type Booking, type Villa, type User } from "@schema";
import { useAppStore } from "@/store/main";

// ======================
// Data Fetchers
// ======================
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Helper for Bearer header
const getAuthHeaders = (token: string | null) =>
  token ? { Authorization: `Bearer ${token}` } : {};

const fetchBooking = async (
  booking_id_param: string,
  token: string | null
): Promise<Booking> => {
  // API expects integer
  const asInt = parseInt(booking_id_param, 10);
  if (isNaN(asInt)) throw new Error("Invalid booking id");
  const { data } = await axios.get(`${API_BASE}/bookings/${asInt}`, {
    headers: getAuthHeaders(token),
  });
  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid booking response");
  return parsed.data;
};

const fetchVilla = async (
  villa_id_param: string | number,
  token: string | null
): Promise<Villa> => {
  // API expects integer
  const asInt = typeof villa_id_param === "number" ? villa_id_param : parseInt(villa_id_param, 10);
  if (isNaN(asInt)) throw new Error("Invalid villa id");
  const { data } = await axios.get(`${API_BASE}/villa/${asInt}`, {
    headers: getAuthHeaders(token),
  });
  const parsed = villaSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid villa response");
  return parsed.data;
};

const fetchCurrentUser = async (
  token: string | null
): Promise<User> => {
  const { data } = await axios.get(`${API_BASE}/account/me`, {
    headers: getAuthHeaders(token),
  });
  const parsed = userSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid user response");
  return parsed.data;
};

// ======================
// Main Component
// ======================
const UV_ReservationDetail: React.FC = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user_session = useAppStore((state) => state.user_session);
  const [active_action_drawer, set_active_action_drawer] = useState<"review" | "cancel" | "modify" | null>(null);
  const [booking_action_error, set_booking_action_error] = useState<string | null>(null);

  // --- Data state variables (for contract/export if needed) ---
  const [guest_user, set_guest_user] = useState<User | null>(null);
  const [host_user, set_host_user] = useState<User | null>(null);

  // ---- Data loading ----
  // 1. Load booking details
  const {
    data: booking,
    isLoading: bookingLoading,
    isError: bookingIsError,
    error: bookingError,
    refetch: refetchBooking,
  } = useQuery<Booking, Error>({
    queryKey: ["reservation", reservationId, user_session.token],
    queryFn: () =>
      reservationId
        ? fetchBooking(reservationId, user_session.token)
        : Promise.reject(new Error("No booking id")),
    enabled: !!reservationId && !!user_session.token,
    retry: false,
  });

  // 2. Load villa details once booking loaded
  // IDs are int per API
  const villaId = typeof booking?.villa_id === "string" ? parseInt(booking.villa_id, 10) : booking?.villa_id;
  const {
    data: villa,
    isLoading: villaLoading,
    isError: villaIsError,
    error: villaError,
  } = useQuery<Villa, Error>({
    queryKey: ["villa", villaId],
    queryFn: () => (villaId ? fetchVilla(villaId, user_session.token) : Promise.reject("no_villa")),
    enabled: !!villaId,
    retry: false,
  });

  // 3. Current user
  const {
    data: currentUser,
    isLoading: currentUserLoading,
    isError: currentUserIsError,
  } = useQuery<User, Error>({
    queryKey: ["me", user_session.token],
    queryFn: () => fetchCurrentUser(user_session.token),
    enabled: !!user_session.token,
    retry: false,
    onSuccess: (usr) => {
      // set state guest_user/host_user per role for contract/export
      if (booking && usr.user_id === booking.guest_user_id) set_guest_user(usr);
      if (booking && usr.user_id === booking.host_user_id) set_host_user(usr);
    },
  });

  // Use derived info
  const is_guest = currentUser && booking && Number(currentUser.user_id) === Number(booking.guest_user_id);
  const is_host = currentUser && booking && Number(currentUser.user_id) === Number(booking.host_user_id);

  // 4. Mutations: Cancel and Modify
  const cancelMutation = useMutation<Booking, Error, void>({
    mutationFn: async () => {
      if (!booking || !user_session.token) throw new Error("Unauthorized");
      const { data } = await axios.delete(`${API_BASE}/bookings/${Number(booking.booking_id)}`, {
        headers: getAuthHeaders(user_session.token),
      });
      const parsed = bookingSchema.safeParse(data);
      if (!parsed.success) throw new Error("Cancel failed: Bad booking response");
      return parsed.data;
    },
    onMutate: () => {
      set_booking_action_error(null);
    },
    onSuccess: (newBooking) => {
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
      set_active_action_drawer(null);
    },
    onError: (error) => {
      set_booking_action_error(error.message);
    },
  });

  type ModifyPayload = {
    checkin_date: string;
    checkout_date: string;
    num_guests: number;
  };
  const [modify_form, set_modify_form] = useState<ModifyPayload | null>(null);
  const modifyMutation = useMutation<Booking, Error, ModifyPayload>({
    mutationFn: async (payload) => {
      if (!booking || !user_session.token) throw new Error("Unauthorized");
      const { data } = await axios.patch(
        `${API_BASE}/bookings/${Number(booking.booking_id)}`,
        payload,
        { headers: getAuthHeaders(user_session.token) }
      );
      const parsed = bookingSchema.safeParse(data);
      if (!parsed.success) throw new Error("Modify failed: Bad booking response");
      return parsed.data;
    },
    onMutate: () => {
      set_booking_action_error(null);
    },
    onSuccess: (newBooking) => {
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
      set_active_action_drawer(null);
    },
    onError: (error) => {
      set_booking_action_error(error.message);
    },
  });

  function canCancel() {
    if (!booking) return false;
    if (!["confirmed", "pending", "requested"].includes(booking.status)) return false;
    if (!is_guest && !is_host) return false;
    return true;
  }
  function canModify() {
    if (!booking) return false;
    if (["cancelled", "rejected", "completed"].includes(booking.status)) return false;
    if (!is_guest && !is_host) return false;
    const nowDate = new Date();
    if (booking.checkout_date && new Date(booking.checkout_date) < nowDate) return false;
    return true;
  }
  function canReview() {
    if (!booking) return false;
    if (booking.status !== "completed") return false;
    if (!is_guest && !is_host) return false;
    return true;
  }
  function isCancelledBooking() {
    if (!booking) return false;
    return booking.status === "cancelled";
  }

  // Fallback guest/host info with better checks
  const guest_user_fallback = booking
    ? {
        user_id: booking.guest_user_id,
        display_name: booking.guest_user_id === currentUser?.user_id && currentUser?.display_name
          ? currentUser.display_name : "Guest",
        profile_photo_url: booking.guest_user_id === currentUser?.user_id && currentUser?.profile_photo_url
          ? currentUser.profile_photo_url
          : `https://picsum.photos/seed/g_${booking.guest_user_id}/80`,
      }
    : null;

  const host_user_fallback = booking
    ? {
        user_id: booking.host_user_id,
        display_name: booking.host_user_id === currentUser?.user_id && currentUser?.display_name
          ? currentUser.display_name : "Host",
        profile_photo_url: booking.host_user_id === currentUser?.user_id && currentUser?.profile_photo_url
          ? currentUser.profile_photo_url
          : `https://picsum.photos/seed/h_${booking.host_user_id}/80`,
      }
    : null;

  // Guest/host display actual
  const guest_info = is_guest && currentUser
    ? {
        user_id: currentUser.user_id,
        display_name: currentUser.display_name || guest_user_fallback?.display_name || "Guest",
        profile_photo_url: currentUser.profile_photo_url || guest_user_fallback?.profile_photo_url,
      }
    : guest_user_fallback;

  const host_info = is_host && currentUser
    ? {
        user_id: currentUser.user_id,
        display_name: currentUser.display_name || host_user_fallback?.display_name || "Host",
        profile_photo_url: currentUser.profile_photo_url || host_user_fallback?.profile_photo_url,
      }
    : host_user_fallback;

  // For contract, also set guest_user/host_user state
  if (!guest_user && guest_info) set_guest_user(guest_info as User);
  if (!host_user && host_info) set_host_user(host_info as User);

  const other_party_info = is_guest ? host_info : guest_info;

  // --- Dates ---
  const checkin = booking?.checkin_date;
  const checkout = booking?.checkout_date;
  let nights: number | null = null;
  if (checkin && checkout) {
    const d1 = new Date(checkin);
    const d2 = new Date(checkout);
    // valid and positive
    if (d2 > d1) nights = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }

  // --- Render ---
  if (bookingLoading || (villaLoading && villaId)) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-blue-600 font-semibold">Loading reservation...</span>
      </div>
    );
  }

  if (bookingIsError || !booking) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <span className="text-red-600 font-bold text-xl">Reservation not found.</span>
        <Link to="/guest/my-trips" className="mt-4 text-blue-600 underline">Back to My Trips</Link>
      </div>
    );
  }

  if (villaIsError) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <span className="text-red-600 font-bold">Unable to load villa information.</span>
        <span className="text-gray-500">{villaError?.message}</span>
      </div>
    );
  }

  const villaPhoto = villa?.main_photo_url || `https://picsum.photos/seed/villa_${booking.villa_id}/400/240`;

  return (
    <>
      {/* Header */}
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b pb-4">
          <div className="flex items-center gap-4">
            <img src={villaPhoto} alt={villa?.title || `Villa photo #${booking.villa_id}`} className="w-32 h-20 object-cover rounded-lg shadow" />
            <div>
              <div className="font-bold text-lg text-gray-800">
                {villa ? (
                  <Link to={`/villa/${villa.villa_id}`} className="hover:underline">
                    {villa.title}
                  </Link>
                ) : (
                  <span>Villa #{booking.villa_id}</span>
                )}
              </div>
              <div className="text-gray-500 text-sm">
                {villa?.address_city}, {villa?.address_country}
              </div>
              <div className="mt-2">
                <span className={`inline-block rounded px-2 py-1 text-xs font-semibold uppercase ${
                  booking.status === "confirmed"
                    ? "bg-green-100 text-green-700"
                    : booking.status === "completed"
                    ? "bg-gray-200 text-gray-700"
                    : booking.status === "cancelled"
                    ? "bg-red-100 text-red-700"
                    : booking.status === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : booking.status === "requested"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
                }`}>
                  {booking.status}
                </span>
                {booking.is_instant_book && (
                  <span className="ml-3 inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                    Instant Book
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Action bar */}
          <div className="flex gap-2">
            {
              canReview() && (
                <Link
                  to={`/review/leave/${booking.booking_id}`}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow text-xs font-medium"
                >
                  Leave Review
                </Link>
              )
            }
            {
              canModify() && (
                <button
                  onClick={() => {
                    set_modify_form({
                      checkin_date: booking.checkin_date,
                      checkout_date: booking.checkout_date,
                      num_guests: booking.num_guests,
                    });
                    set_active_action_drawer("modify");
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded shadow text-xs font-medium"
                >
                  Modify
                </button>
              )
            }
            {
              canCancel() && (
                <button
                  onClick={() => set_active_action_drawer("cancel")}
                  className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded shadow text-xs font-medium"
                >
                  Cancel
                </button>
              )
            }
            <Link
              to={`/messaging?booking_id=${booking.booking_id}`}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded shadow text-xs font-medium"
            >
              {is_guest ? "Contact Host" : "Message Guest"}
            </Link>
          </div>
        </div>

        {/* Main booking details */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stay Summary */}
          <section className="col-span-1 bg-gray-50 rounded shadow p-5">
            <div className="mb-4">
              <div className="font-semibold text-gray-700">Stay Details</div>
              <div className="mt-2 text-gray-600 text-sm flex flex-col gap-1">
                <span>
                  <span className="font-medium">Check-in:</span>{" "}
                  <span>{booking.checkin_date}</span>
                </span>
                <span>
                  <span className="font-medium">Check-out:</span>{" "}
                  <span>{booking.checkout_date}</span>
                </span>
                <span>
                  <span className="font-medium">Nights:</span>{" "}
                  <span>{nights && nights > 0 ? nights : "?"}</span>
                </span>
                <span>
                  <span className="font-medium">Guests:</span> {booking.num_guests}
                </span>
              </div>
            </div>
            <div className="mb-4">
              <div className="font-semibold text-gray-700">Guest</div>
              <div className="flex items-center gap-3 mt-2">
                <img
                  src={
                    guest_info?.profile_photo_url ||
                    "https://picsum.photos/seed/guest/40"
                  }
                  alt={`Guest: ${guest_info?.display_name || "Guest"}`}
                  className="w-10 h-10 object-cover rounded-full"
                />
                <span className="font-medium text-sm">
                  {guest_info?.display_name || "Guest"}
                </span>
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-700">Host</div>
              <div className="flex items-center gap-3 mt-2">
                <img
                  src={
                    host_info?.profile_photo_url ||
                    "https://picsum.photos/seed/host/40"
                  }
                  alt={`Host: ${host_info?.display_name || "Host"}`}
                  className="w-10 h-10 object-cover rounded-full"
                />
                <span className="font-medium text-sm">
                  {host_info?.display_name || "Host"}
                </span>
              </div>
            </div>
          </section>

          {/* Charges/summary */}
          <section className="col-span-1 bg-white rounded shadow p-5 border">
            <div className="font-semibold text-gray-700 mb-3">Price Breakdown</div>
            <ul className="text-sm text-gray-700 mb-2">
              <li className="flex justify-between py-1">
                <span>Per night x {nights && nights > 0 ? nights : "?"}</span>
                <span>
                  ${booking.nightly_price} &times; {nights && nights > 0 ? nights : "?"} = $
                  {nights && nights > 0 ? booking.nightly_price * nights : "--"}
                </span>
              </li>
              <li className="flex justify-between py-1">
                <span>Cleaning fee</span>
                <span>${booking.cleaning_fee}</span>
              </li>
              <li className="flex justify-between py-1">
                <span>Service fee</span>
                <span>${booking.service_fee}</span>
              </li>
              <li className="flex justify-between py-1">
                <span>Taxes</span>
                <span>${booking.taxes}</span>
              </li>
              <li className="flex justify-between font-bold border-t pt-2 mt-2">
                <span>Total</span>
                <span>${booking.total_price}</span>
              </li>
            </ul>
            <div className="text-xs text-gray-500">
              Payment:
              <span className="ml-2 font-bold">
                {booking.payment_status === "paid"
                  ? "Paid"
                  : booking.payment_status}
              </span>
            </div>
            {isCancelledBooking() && booking.cancellation_reason && (
              <div className="mt-4 p-2 border-l-4 border-red-400 bg-red-50 text-sm text-red-700">
                <div className="font-semibold">
                  Cancelled: {booking.cancellation_date ? new Date(booking.cancellation_date).toLocaleString() : ""}
                </div>
                <div>{booking.cancellation_reason}</div>
              </div>
            )}
          </section>
        </div>

        {/* Policy and rules block */}
        <div className="mt-8 bg-gray-50 rounded shadow p-4">
          <div className="font-semibold text-gray-700 mb-2">Policies</div>
          <ul className="text-gray-700 text-sm flex flex-col gap-1">
            {villa?.cancellation_policy && (
              <li>
                <span className="font-medium">Cancellation:</span>{" "}
                <span className="capitalize">{villa.cancellation_policy}</span>
              </li>
            )}
            {villa?.min_nights && (
              <li>
                <span className="font-medium">Minimum nights:</span> {villa.min_nights}
              </li>
            )}
            {villa?.max_nights && (
              <li>
                <span className="font-medium">Maximum nights:</span> {villa.max_nights}
              </li>
            )}
            {typeof villa?.is_pet_friendly === "boolean" && (
              <li>
                <span className="font-medium">Pet Friendly:</span>{" "}
                {villa.is_pet_friendly ? "Yes" : "No"}
              </li>
            )}
            {typeof villa?.is_beachfront === "boolean" && (
              <li>
                <span className="font-medium">Beachfront:</span>{" "}
                {villa.is_beachfront ? "Yes" : "No"}
              </li>
            )}
          </ul>
        </div>

        {/* --- Modals/Drawers (cancel/modify/review) --- */}
        {(active_action_drawer === "cancel") && (
          <div className="fixed z-50 top-0 left-0 w-full h-full bg-black bg-opacity-30 flex items-center justify-center">
            <div className="bg-white rounded shadow-lg w-full max-w-md p-6">
              <div className="mb-3 font-bold text-lg">Cancel Reservation</div>
              <div className="mb-4 text-sm text-gray-700">
                Are you sure you want to cancel this reservation?
              </div>
              {booking_action_error && (
                <div className="mb-2 text-red-600">{booking_action_error}</div>
              )}
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => set_active_action_drawer(null)}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                  disabled={cancelMutation.isLoading}
                >
                  Back
                </button>
                <button
                  className="px-4 py-1 rounded bg-red-600 text-white font-bold hover:bg-red-800"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isLoading}
                >
                  {cancelMutation.isLoading ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {(active_action_drawer === "modify") && (
          <div className="fixed z-50 top-0 left-0 w-full h-full bg-black bg-opacity-30 flex items-center justify-center">
            <div className="bg-white rounded shadow-lg w-full max-w-lg p-6">
              <div className="mb-4 font-bold text-lg">Modify Reservation</div>
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!modify_form) return;
                  // Validity check
                  const cin = new Date(modify_form.checkin_date);
                  const cout = new Date(modify_form.checkout_date);
                  if (!(cin < cout)) {
                    set_booking_action_error("Check-out date must be after check-in date.");
                    return;
                  }
                  if (modify_form.num_guests < 1 || (villa?.max_guests && modify_form.num_guests > villa.max_guests)) {
                    set_booking_action_error(`Guests must be between 1 and ${villa?.max_guests}`);
                    return;
                  }
                  set_booking_action_error(null);
                  modifyMutation.mutate(modify_form);
                }}
              >
                <div>
                  <label className="block text-gray-700 text-sm mb-1">Check-in Date</label>
                  <input
                    type="date"
                    className="input input-bordered w-full"
                    value={modify_form?.checkin_date || ""}
                    min={new Date().toISOString().substring(0, 10)}
                    onChange={(e) =>
                      set_modify_form((prev) =>
                        prev ? { ...prev, checkin_date: e.target.value } : null
                      )
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm mb-1">Check-out Date</label>
                  <input
                    type="date"
                    className="input input-bordered w-full"
                    value={modify_form?.checkout_date || ""}
                    min={
                      modify_form?.checkin_date
                        ? modify_form.checkin_date
                        : new Date().toISOString().substring(0, 10)
                    }
                    onChange={(e) =>
                      set_modify_form((prev) =>
                        prev ? { ...prev, checkout_date: e.target.value } : null
                      )
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm mb-1">Guests</label>
                  <input
                    type="number"
                    min={1}
                    max={villa?.max_guests || 16}
                    className="input input-bordered w-full"
                    value={modify_form?.num_guests || 1}
                    onChange={(e) =>
                      set_modify_form((prev) =>
                        prev
                          ? { ...prev, num_guests: Number(e.target.value) }
                          : null
                      )
                    }
                    required
                  />
                </div>
                {booking_action_error && (
                  <div className="mb-2 text-red-600">{booking_action_error}</div>
                )}
                <div className="flex gap-3 justify-end mt-4">
                  <button
                    type="button"
                    onClick={() => set_active_action_drawer(null)}
                    className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                    disabled={modifyMutation.isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modifyMutation.isLoading}
                    className="px-4 py-1 rounded bg-yellow-600 text-white font-bold hover:bg-yellow-700"
                  >
                    {modifyMutation.isLoading ? "Modifying..." : "Confirm Change"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_ReservationDetail;