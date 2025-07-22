import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/main';
import { z } from 'zod';

// --- Types from zod schemas ---
import {
  bookingSchema,
  villaSchema,
} from '@schema';

// Needed types
type Booking = z.infer<typeof bookingSchema>;
type Villa = z.infer<typeof villaSchema>;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * Fetch user's bookings (trips) - categorized
 */
const fetchMyTrips = async (token: string): Promise<{
  bookings_upcoming: Booking[];
  bookings_past: Booking[];
  bookings_cancelled: Booking[];
}> => {
  const { data } = await axios.get(`${API_BASE_URL}/account/my_trips`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Validate and convert by zod
  return {
    bookings_upcoming: (data.upcoming ?? []).map((b: any) =>
      bookingSchema.parse(b)
    ),
    bookings_past: (data.past ?? []).map((b: any) =>
      bookingSchema.parse(b)
    ),
    bookings_cancelled: (data.cancelled ?? []).map((b: any) =>
      bookingSchema.parse(b)
    ),
  };
};

/**
 * Fetch villa info by id
 */
const fetchVilla = async ({
  villa_id,
}: {
  villa_id: number;
}): Promise<Villa | null> => {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/villa/${villa_id}`);
    return villaSchema.parse(data);
  } catch (e) {
    // Not found or deleted: return null
    return null;
  }
};

/**
 * Cancel booking by booking_id
 */
const cancelBooking = async ({
  booking_id,
  token,
}: {
  booking_id: number;
  token: string;
}): Promise<Booking> => {
  const { data } = await axios.delete(
    `${API_BASE_URL}/bookings/${booking_id}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return bookingSchema.parse(data);
};

/**
 * Modify booking
 */
const modifyBooking = async ({
  booking_id,
  token,
  checkin_date,
  checkout_date,
  num_guests,
}: {
  booking_id: number;
  token: string;
  checkin_date: string;
  checkout_date: string;
  num_guests: number;
}): Promise<Booking> => {
  const { data } = await axios.patch(
    `${API_BASE_URL}/bookings/${booking_id}`,
    {
      checkin_date,
      checkout_date,
      num_guests,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return bookingSchema.parse(data);
};

const tabLabels: Record<'upcoming' | 'past' | 'cancelled', string> = {
  upcoming: 'Upcoming',
  past: 'Past',
  cancelled: 'Cancelled',
};

const bookingStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'requested':
      return 'Requested';
    case 'confirmed':
      return 'Confirmed';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'rejected':
      return 'Rejected';
    case 'modified':
      return 'Modified';
    default:
      return status;
  }
};

/**
 * Main MyTrips Component
 */
const UV_MyTrips: React.FC = () => {
  // Auth/User state
  const token = useAppStore((s) => s.user_session.token);
  const is_authenticated = useAppStore((s) => s.user_session.is_authenticated);
  // const user_id = useAppStore(s => s.user_session.user_id); // not used
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ----- Tab state -----
  const [active_tab, set_active_tab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  // -- State for action loading/error per booking --
  const [booking_action_loading, set_booking_action_loading] = useState<{ [booking_id: string]: boolean }>({});
  const [booking_action_error, set_booking_action_error] = useState<{ [booking_id: string]: string | null }>({});
  const [expanded_modify_booking, set_expanded_modify_booking] = useState<{ [booking_id: string]: boolean }>({});

  // -- State for in-place modify booking form --
  type ModifyState = {
    checkin_date: string;
    checkout_date: string;
    num_guests: number;
  };
  const [modify_state, set_modify_state] = useState<{ [booking_id: string]: ModifyState }>({});

  // --- Fetch bookings (all tabs) ---
  const {
    data: bookingsData,
    isLoading: isBookingsLoading,
    isError: isBookingsError,
    error: bookingsError,
    refetch: refetchMyTrips,
  } = useQuery(
    ['my_trips', token],
    () => {
      if (!token) throw new Error('No token');
      return fetchMyTrips(token);
    },
    {
      enabled: !!token,
      staleTime: 1000 * 60, // 1min
      retry: 2,
    }
  );

  // -- Gather villa ids for all bookings (all statuses) --
  const allBookings = useMemo(
    () => [
      ...(bookingsData?.bookings_upcoming ?? []),
      ...(bookingsData?.bookings_past ?? []),
      ...(bookingsData?.bookings_cancelled ?? []),
    ],
    [bookingsData]
  );
  const allVillaIds: number[] = Array.from(
    new Set(
      allBookings.map((b) => Number(b.villa_id)).filter((id) => !Number.isNaN(id))
    )
  );

  // -- Cache and fetch all needed villas using useQueries --
  const villaQueries = useQueries({
    queries: allVillaIds.map((villa_id) => ({
      queryKey: ['villa', villa_id],
      queryFn: () => fetchVilla({ villa_id }),
      enabled: !!villa_id,
      staleTime: 1000 * 60 * 60, // 1hr
    })),
  });

  const villaById: Record<string, Villa | null> = {};
  allVillaIds.forEach((villa_id, idx) => {
    villaById[String(villa_id)] = villaQueries[idx]?.data === undefined ? null : villaQueries[idx].data;
  });

  // --- Cancel Booking Mutation ---
  const cancelBookingMutation = useMutation({
    mutationFn: async (booking_id: string) => {
      if (!token) throw new Error('Missing token');
      return await cancelBooking({ booking_id: Number(booking_id), token });
    },
    onMutate: (booking_id) => {
      set_booking_action_loading((v) => ({ ...v, [booking_id]: true }));
      set_booking_action_error((e) => ({ ...e, [booking_id]: null }));
    },
    onSuccess: (_, booking_id) => {
      set_booking_action_loading((v) => ({ ...v, [booking_id]: false }));
      // Refetch trips after cancel
      queryClient.invalidateQueries({ queryKey: ['my_trips'] });
    },
    onError: (err: any, booking_id) => {
      set_booking_action_loading((v) => ({ ...v, [booking_id]: false }));
      const msg = err?.response?.data?.error || err?.message || 'Error cancelling booking';
      set_booking_action_error((e) => ({ ...e, [booking_id]: msg }));
    },
  });

  // --- Modify Booking Mutation ---
  const modifyBookingMutation = useMutation({
    mutationFn: async ({
      booking_id,
      checkin_date,
      checkout_date,
      num_guests,
    }: { booking_id: string; checkin_date: string; checkout_date: string; num_guests: number }) => {
      if (!token) throw new Error('Missing token');
      return await modifyBooking({
        booking_id: Number(booking_id),
        token,
        checkin_date,
        checkout_date,
        num_guests,
      });
    },
    onMutate: ({ booking_id }) => {
      set_booking_action_loading((v) => ({ ...v, [booking_id]: true }));
      set_booking_action_error((e) => ({ ...e, [booking_id]: null }));
    },
    onSuccess: (_, vars) => {
      set_booking_action_loading((v) => ({ ...v, [vars.booking_id]: false }));
      set_expanded_modify_booking((e) => ({ ...e, [vars.booking_id]: false }));
      queryClient.invalidateQueries({ queryKey: ['my_trips'] });
    },
    onError: (err: any, vars) => {
      set_booking_action_loading((v) => ({ ...v, [vars.booking_id]: false }));
      const msg = err?.response?.data?.error || err?.message || 'Error modifying booking';
      set_booking_action_error((e) => ({ ...e, [vars.booking_id]: msg }));
    },
  });

  // -- Handler: Cancel Booking --
  const handleCancelBooking = (booking_id: string) => {
    cancelBookingMutation.mutate(booking_id);
  };

  // -- Handler: Expand Modify --
  const handleExpandModify = (booking: Booking) => {
    set_expanded_modify_booking((e) => ({
      ...e,
      [booking.booking_id]: !e[booking.booking_id],
    }));
    set_modify_state((ms) => ({
      ...ms,
      [booking.booking_id]: {
        checkin_date: booking.checkin_date,
        checkout_date: booking.checkout_date,
        num_guests: booking.num_guests,
      },
    }));
  };

  // -- Handler: Modify Booking Submit --
  const handleModifyBooking = (booking_id: string) => {
    const { checkin_date, checkout_date, num_guests } = modify_state[booking_id];
    // Date and guest validation (minimal)
    if (!checkin_date || !checkout_date || !num_guests) {
      set_booking_action_error((e) => ({
        ...e,
        [booking_id]: 'All fields are required',
      }));
      return;
    }
    modifyBookingMutation.mutate({
      booking_id,
      checkin_date,
      checkout_date,
      num_guests,
    });
  };

  // --- Tab Booking List ---
  const bookingsForTab = useMemo(() => {
    if (!bookingsData) return [];
    if (active_tab === 'upcoming') return bookingsData.bookings_upcoming;
    if (active_tab === 'past') return bookingsData.bookings_past;
    if (active_tab === 'cancelled') return bookingsData.bookings_cancelled;
    return [];
  }, [bookingsData, active_tab]);

  // --- Auth Guard / Redirect ---
  React.useEffect(() => {
    if (!is_authenticated) {
      navigate('/guest/login');
    }
  }, [is_authenticated, navigate]);

  // --- Main Render ---
  return (
    <>
      <div className="max-w-4xl mx-auto pt-8 pb-20 px-2 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">My Trips</h1>

        {/* Tabs */}
        <div className="flex space-x-2 mb-8 border-b">
          {(['upcoming', 'past', 'cancelled'] as const).map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 border-b-2 font-medium transition-colors ${
                active_tab === tab
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-primary-500'
              }`}
              onClick={() => set_active_tab(tab)}
              data-testid={`tab-${tab}`}
              type="button"
            >
              {tabLabels[tab]}
              {bookingsData && 
                (tab === 'upcoming' && bookingsData.bookings_upcoming.length > 0
                  ? (
                    <span className="ml-1 text-xs text-primary-700 font-bold">
                      ({bookingsData.bookings_upcoming.length})
                    </span>
                  )
                  : tab === 'past' && bookingsData.bookings_past.length > 0
                  ? (
                    <span className="ml-1 text-xs text-primary-700 font-bold">
                      ({bookingsData.bookings_past.length})
                    </span>
                  )
                  : tab === 'cancelled' && bookingsData.bookings_cancelled.length > 0
                  ? (
                    <span className="ml-1 text-xs text-primary-700 font-bold">
                      ({bookingsData.bookings_cancelled.length})
                    </span>
                  ) : null)}
            </button>
          ))}
          <button
            className="ml-auto px-3 py-2 text-xs font-semibold rounded hover:bg-gray-100 text-gray-500"
            onClick={() => refetchMyTrips()}
            type="button"
          >
            Refresh
          </button>
        </div>

        {/* Loading/Error/Empty */}
        {isBookingsLoading ? (
          <div className="py-32 text-center text-lg text-primary-600 font-medium animate-pulse">
            Loading your trips...
          </div>
        ) : isBookingsError ? (
          <div className="py-32 text-center text-red-600 font-bold">
            Unable to load your trips. Please try again.
            {bookingsError instanceof Error && (
              <div className="mt-2 text-sm font-mono text-gray-500">
                {bookingsError.message}
              </div>
            )}
            <button
              className="block mx-auto mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              onClick={() => refetchMyTrips()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : bookingsForTab.length === 0 ? (
          <div className="w-full min-h-32 flex flex-col items-center justify-center py-20 text-center">
            <img
              src="https://picsum.photos/seed/vacationempty1/180/110"
              alt="Plan next trip"
              className="mx-auto rounded mb-4 shadow"
              width={180}
              height={110}
            />
            <div className="text-lg text-gray-800 font-semibold mb-2">
              Plan your next beach escape
            </div>
            <div className="text-gray-500 mb-6">
              You have no {tabLabels[active_tab].toLowerCase()} trips yet.
            </div>
            <Link
              to="/search"
              className="inline-block px-5 py-2 bg-primary-600 text-white rounded-lg text-base shadow hover:bg-primary-700 transition"
            >
              Discover Villas
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {bookingsForTab.map((booking) => {
              const villa = villaById[String(booking.villa_id)];
              const isBookingActionLoading = !!booking_action_loading[booking.booking_id];
              const bookingActionError = booking_action_error[booking.booking_id];
              const canCancel = 
                active_tab === 'upcoming' && 
                booking.status !== 'cancelled' && 
                booking.status !== 'completed';
              const canModify = 
                active_tab === 'upcoming' && 
                booking.status !== 'cancelled' && 
                booking.status !== 'completed';
              const canLeaveReview = 
                active_tab === 'past' && 
                booking.status === 'completed';
              return (
                <div
                  className="bg-white border rounded-lg shadow-sm flex flex-col sm:flex-row"
                  key={booking.booking_id}
                  data-testid={`booking-card-${booking.booking_id}`}
                >
                  {/* Villa image */}
                  <div className="sm:w-48 w-full flex-shrink-0">
                    {villa && villa.main_photo_url ? (
                      <img
                        src={villa.main_photo_url}
                        alt={villa.title}
                        className="h-36 w-full object-cover rounded-t-lg sm:rounded-l-lg sm:rounded-t-none"
                        width={192}
                        height={144}
                        loading="lazy"
                      />
                    ) : (
                      <img
                        src={`https://picsum.photos/seed/villa${booking.villa_id}/200/150`}
                        alt="Villa"
                        className="h-36 w-full object-cover rounded-t-lg sm:rounded-l-lg sm:rounded-t-none"
                        width={192}
                        height={144}
                        loading="lazy"
                      />
                    )}
                  </div>
                  {/* Booking Info */}
                  <div className="flex-1 flex flex-col p-4">
                    {/* Villa Title and Details */}
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <div>
                        <div className="text-lg font-bold text-gray-900">
                          {villa ? villa.title : 'Villa unavailable'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {booking.checkin_date} &rarr; {booking.checkout_date}
                          {'  '}
                          <span className="inline ml-2 text-xs font-medium bg-gray-100 px-2 rounded">
                            {booking.num_guests} guest{booking.num_guests !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs py-1 px-2 rounded bg-blue-50 text-blue-700 font-semibold">
                            {bookingStatusLabel(booking.status)}
                          </span>
                          {booking.is_instant_book && (
                            <span className="text-xs py-1 px-2 rounded bg-green-100 text-green-700 font-semibold">
                              Instant Book
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right mt-2 sm:mt-0">
                        <div className="text-[15px] text-gray-700 font-semibold">
                          ${booking.total_price.toFixed(2)}
                          <span className="ml-1 text-xs font-normal text-gray-400">
                            total
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          Night: ${booking.nightly_price.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {booking.num_guests} guest{booking.num_guests !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    {/* Buttons/actions */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Link
                        to={`/reservation/${booking.booking_id}`}
                        className="px-4 py-1 bg-gray-100 text-gray-800 rounded font-medium hover:bg-gray-200 transition"
                      >
                        Details
                      </Link>
                      {canCancel && (
                        <button
                          className={`px-4 py-1 rounded font-medium transition
                            ${isBookingActionLoading
                              ? 'bg-gray-200 text-gray-400'
                              : 'bg-rose-500 text-white hover:bg-rose-600'
                            }`}
                          disabled={isBookingActionLoading}
                          onClick={() => handleCancelBooking(booking.booking_id)}
                          type="button"
                        >
                          {isBookingActionLoading
                            ? 'Cancelling...'
                            : 'Cancel'}
                        </button>
                      )}
                      {canModify && (
                        <button
                          className="px-4 py-1 rounded font-medium bg-primary-100 text-primary-900 hover:bg-primary-200 transition"
                          type="button"
                          onClick={() => handleExpandModify(booking)}
                          disabled={isBookingActionLoading}
                        >
                          {expanded_modify_booking[booking.booking_id]
                            ? 'Close'
                            : 'Modify'}
                        </button>
                      )}
                      <Link
                        to={`/messaging?booking_id=${booking.booking_id}`}
                        className="px-4 py-1 rounded font-medium bg-blue-50 text-blue-800 hover:bg-blue-100 transition"
                        data-testid={`contact-host-${booking.booking_id}`}
                      >
                        Contact Host
                      </Link>
                      {canLeaveReview && (
                        <Link
                          to={`/review/leave/${booking.booking_id}`}
                          className="px-4 py-1 rounded font-medium bg-yellow-50 text-yellow-800 hover:bg-yellow-100 transition"
                        >
                          Leave Review
                        </Link>
                      )}
                      {(active_tab === 'past' || active_tab === 'cancelled') && villa && (
                        <Link
                          to={`/villa/${villa.villa_id}`}
                          className="px-4 py-1 rounded font-medium bg-teal-50 text-teal-900 hover:bg-teal-100 transition"
                        >
                          Book Again
                        </Link>
                      )}
                    </div>
                    {/* Action Error Message */}
                    {bookingActionError && (
                      <div className="mt-2 text-xs text-red-600">
                        {bookingActionError}
                      </div>
                    )}
                    {/* Expand: Modify booking form */}
                    {expanded_modify_booking[booking.booking_id] && (
                      <div className="mt-4 bg-gray-50 border p-4 rounded-lg w-full">
                        <div className="text-sm font-semibold mb-2">
                          Modify Trip
                        </div>
                        <label className="block text-xs font-medium text-gray-700 mt-2">
                          Check-in Date
                          <input
                            type="date"
                            value={modify_state[booking.booking_id]?.checkin_date || ''}
                            onChange={e => 
                              set_modify_state((ms) => ({
                                ...ms,
                                [booking.booking_id]: {
                                  ...ms[booking.booking_id],
                                  checkin_date: e.target.value,
                                },
                              }))
                            }
                            className="mt-1 block w-full border rounded px-2 py-1 text-sm"
                            disabled={isBookingActionLoading}
                          />
                        </label>
                        <label className="block text-xs font-medium text-gray-700 mt-2">
                          Check-out Date
                          <input
                            type="date"
                            value={modify_state[booking.booking_id]?.checkout_date || ''}
                            onChange={e => 
                              set_modify_state((ms) => ({
                                ...ms,
                                [booking.booking_id]: {
                                  ...ms[booking.booking_id],
                                  checkout_date: e.target.value,
                                },
                              }))
                            }
                            className="mt-1 block w-full border rounded px-2 py-1 text-sm"
                            disabled={isBookingActionLoading}
                          />
                        </label>
                        <label className="block text-xs font-medium text-gray-700 mt-2">
                          Number of Guests
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={modify_state[booking.booking_id]?.num_guests ?? 1}
                            onChange={e => 
                              set_modify_state((ms) => ({
                                ...ms,
                                [booking.booking_id]: {
                                  ...ms[booking.booking_id],
                                  num_guests: Number(e.target.value),
                                },
                              }))
                            }
                            className="mt-1 block w-full border rounded px-2 py-1 text-sm"
                            disabled={isBookingActionLoading}
                          />
                        </label>
                        <div className="flex gap-2 mt-4">
                          <button
                            className={`px-4 py-1 rounded font-medium transition ${
                              isBookingActionLoading
                                ? 'bg-gray-200 text-gray-400'
                                : 'bg-primary-600 text-white hover:bg-primary-700'
                            }`}
                            disabled={isBookingActionLoading}
                            type="button"
                            onClick={() => handleModifyBooking(booking.booking_id)}
                          >
                            {isBookingActionLoading ? 'Saving...' : 'Confirm Changes'}
                          </button>
                          <button
                            className="px-4 py-1 bg-gray-100 text-gray-700 rounded font-medium hover:bg-gray-200 transition"
                            type="button"
                            disabled={isBookingActionLoading}
                            onClick={() => 
                              set_expanded_modify_booking((e) => ({
                                ...e,
                                [booking.booking_id]: false,
                              }))
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default UV_MyTrips;