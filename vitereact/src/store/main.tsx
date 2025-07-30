import { create } from "zustand";
import { persist } from "zustand/middleware";
import { io, Socket } from "socket.io-client";

// ======================
// Types
// ======================
export type UserSession = {
	user_id: number | null;
	is_authenticated: boolean;
	is_host: boolean;
	token: string | null;
	display_name: string | null;
	profile_photo_url: string | null;
	superhost_status: boolean;
	unread_message_count: number;
	last_active_at: string | null;
	email: string | null;
};

export type SearchFilters = {
	price_min: number | null;
	price_max: number | null;
	bedrooms: number | null;
	beds: number | null;
	bathrooms: number | null;
	amenities: number[];
	is_beachfront: boolean | null;
	is_pet_friendly: boolean | null;
	is_instant_book: boolean | null;
};

export type SearchState = {
	location: string;
	checkin_date: string | null;
	checkout_date: string | null;
	num_guests: number;
	filters: SearchFilters;
	sort: string;
	page: number;
};

export type NotificationItem = {
	id: number;
	type: string;
	message: string;
	is_read: boolean;
	reference_id: number | null;
	created_at: string;
};

export type NotificationsState = {
	items: NotificationItem[];
	unread_count: number;
};

export type MessageThread = {
	thread_id: number;
	participant_user_id: number;
	villa_id: number | null;
	booking_id: number | null;
	last_message_preview: string;
	unread_count: number;
	updated_at: string;
};

export type MessagingThreadsState = {
	threads: MessageThread[];
};

export type GuestDetails = {
	name: string;
	email: string;
	phone: string | null;
	special_requests: string | null;
};

export type PriceSummary = {
	nightly_price: number;
	cleaning_fee: number;
	service_fee: number;
	taxes: number;
	total_price: number;
};

export type BookingCart = {
	villa_id: number | null;
	checkin_date: string | null;
	checkout_date: string | null;
	num_guests: number;
	guest_details: GuestDetails;
	price_summary: PriceSummary;
	status: string;
};

export type Wishlist = {
	wishlist_id: number;
	name: string;
	villa_ids: number[];
	is_deleted: boolean;
	created_at: string;
	updated_at: string;
};

export type WishlistState = {
	wishlists: Wishlist[];
};

export type HostDashboardVilla = {
	villa_id: number;
	title: string;
	published_at: string | null;
	is_active: boolean;
	main_photo_url: string;
	pending_reservations: number;
	upcoming_reservations: number;
};

export type HostDashboardNotification = {
	id: number;
	message: string;
	is_read: boolean;
};

export type HostDashboardState = {
	villas: HostDashboardVilla[];
	revenue_summary: { total: number; upcoming: number };
	notifications: HostDashboardNotification[];
};

export type ReviewModalState = {
	booking_id: number | null;
	villa_id: number | null;
	is_open: boolean;
	type: string | null;
};

export type LastEvent = {
	type: string;
	payload: any;
} | null;

// =======================
// Store State Type
// =======================
type AppStore = {
	// Auth/session
	user_session: UserSession;
	set_user_session: (session: Partial<UserSession>) => void;
	reset_user_session: () => void;
	logout: () => void;

	// Search
	search_state: SearchState;
	set_search_state: (search: Partial<SearchState>) => void;
	reset_search_state: () => void;

	// Notifications
	notifications: NotificationsState;
	set_notifications: (n: NotificationsState) => void;
	add_notification: (item: NotificationItem) => void;
	mark_notification_read: (notification_id: number) => void;
	reset_notifications: () => void;

	// Messaging threads
	messaging_threads: MessagingThreadsState;
	set_messaging_threads: (msg: MessagingThreadsState) => void;
	add_message_thread: (thread: MessageThread) => void;
	update_message_thread: (
		thread_id: number,
		props: Partial<MessageThread>,
	) => void;
	reset_messaging_threads: () => void;

	// Booking cart
	booking_cart: BookingCart;
	set_booking_cart: (cart: Partial<BookingCart>) => void;
	reset_booking_cart: () => void;

	// Wishlists
	wishlist_state: WishlistState;
	set_wishlist_state: (wl: WishlistState) => void;
	reset_wishlist_state: () => void;

	// Host dashboard
	host_dashboard_state: HostDashboardState;
	set_host_dashboard_state: (hd: Partial<HostDashboardState>) => void;
	reset_host_dashboard_state: () => void;

	// Review modal
	review_modal_state: ReviewModalState;
	set_review_modal_state: (rv: Partial<ReviewModalState>) => void;
	reset_review_modal_state: () => void;

	// --- Realtime/socket state ---
	socket_connected: boolean;
	last_event_received: LastEvent;
	connect_socket: (token: string | null) => void;
	disconnect_socket: () => void;
	// Not persisted:
	_socket?: Socket | null; // (not in persisted state)
};

// =======================
// Defaults for slices
// =======================
const DEFAULT_USER_SESSION: UserSession = {
	user_id: null,
	is_authenticated: false,
	is_host: false,
	token: null,
	display_name: null,
	profile_photo_url: null,
	superhost_status: false,
	unread_message_count: 0,
	last_active_at: null,
	email: null,
};
const DEFAULT_SEARCH_STATE: SearchState = {
	location: "",
	checkin_date: null,
	checkout_date: null,
	num_guests: 1,
	filters: {
		price_min: null,
		price_max: null,
		bedrooms: null,
		beds: null,
		bathrooms: null,
		amenities: [],
		is_beachfront: null,
		is_pet_friendly: null,
		is_instant_book: null,
	},
	sort: "recommended",
	page: 1,
};

const DEFAULT_NOTIFICATIONS: NotificationsState = {
	items: [],
	unread_count: 0,
};

const DEFAULT_MESSAGING_THREADS: MessagingThreadsState = {
	threads: [],
};

const DEFAULT_BOOKING_CART: BookingCart = {
	villa_id: null,
	checkin_date: null,
	checkout_date: null,
	num_guests: 1,
	guest_details: {
		name: "",
		email: "",
		phone: null,
		special_requests: null,
	},
	price_summary: {
		nightly_price: 0,
		cleaning_fee: 0,
		service_fee: 0,
		taxes: 0,
		total_price: 0,
	},
	status: "idle",
};

const DEFAULT_WISHLIST_STATE: WishlistState = {
	wishlists: [],
};

const DEFAULT_HOST_DASHBOARD_STATE: HostDashboardState = {
	villas: [],
	revenue_summary: { total: 0, upcoming: 0 },
	notifications: [],
};

const DEFAULT_REVIEW_MODAL_STATE: ReviewModalState = {
	booking_id: null,
	villa_id: null,
	is_open: false,
	type: null,
};

// ================
// Zustand Store
// ================

export const useAppStore = create<AppStore>()(
	persist(
		(set, get) => ({
			// --- User session ---
			user_session: { ...DEFAULT_USER_SESSION },
			set_user_session: (session) =>
				set((state) => ({
					user_session: { ...state.user_session, ...session },
				})),
			reset_user_session: () =>
				set(() => ({ user_session: { ...DEFAULT_USER_SESSION } })),
			logout: () => {
				set({
					user_session: { ...DEFAULT_USER_SESSION },
					notifications: { ...DEFAULT_NOTIFICATIONS },
					messaging_threads: { ...DEFAULT_MESSAGING_THREADS },
					wishlist_state: { ...DEFAULT_WISHLIST_STATE },
					booking_cart: { ...DEFAULT_BOOKING_CART },
					host_dashboard_state: { ...DEFAULT_HOST_DASHBOARD_STATE },
				});
				get().disconnect_socket();
			},

			// --- Search ---
			search_state: { ...DEFAULT_SEARCH_STATE },
			set_search_state: (search) =>
				set((state) => ({
					search_state: { ...state.search_state, ...search },
				})),
			reset_search_state: () =>
				set(() => ({ search_state: { ...DEFAULT_SEARCH_STATE } })),

			// --- Notifications ---
			notifications: { ...DEFAULT_NOTIFICATIONS },
			set_notifications: (n) => set(() => ({ notifications: n })),
			add_notification: (item) =>
				set((state) => ({
					notifications: {
						...state.notifications,
						items: [item, ...state.notifications.items],
						unread_count: state.notifications.unread_count + (item.is_read ? 0 : 1),
					},
				})),
			mark_notification_read: (notification_id) =>
				set((state) => {
					const items = state.notifications.items.map((n) =>
						n.id === notification_id ? { ...n, is_read: true } : n,
					);
					const unread = items.reduce((cnt, n) => (!n.is_read ? cnt + 1 : cnt), 0);
					return {
						notifications: { items, unread_count: unread },
					};
				}),
			reset_notifications: () =>
				set(() => ({ notifications: { ...DEFAULT_NOTIFICATIONS } })),

			// --- Messaging threads ---
			messaging_threads: { ...DEFAULT_MESSAGING_THREADS },
			set_messaging_threads: (msg) => set(() => ({ messaging_threads: msg })),
			add_message_thread: (thread) =>
				set((state) => ({
					messaging_threads: {
						...state.messaging_threads,
						threads: [
							thread,
							...state.messaging_threads.threads.filter(
								(t) => t.thread_id !== thread.thread_id,
							),
						],
					},
				})),
			update_message_thread: (thread_id, props) =>
				set((state) => ({
					messaging_threads: {
						...state.messaging_threads,
						threads: state.messaging_threads.threads.map((t) =>
							t.thread_id === thread_id ? { ...t, ...props } : t,
						),
					},
				})),
			reset_messaging_threads: () =>
				set(() => ({ messaging_threads: { ...DEFAULT_MESSAGING_THREADS } })),

			// --- Booking cart ---
			booking_cart: { ...DEFAULT_BOOKING_CART },
			set_booking_cart: (cart) =>
				set((state) => ({
					booking_cart: { ...state.booking_cart, ...cart },
				})),
			reset_booking_cart: () =>
				set(() => ({ booking_cart: { ...DEFAULT_BOOKING_CART } })),

			// --- Wishlists ---
			wishlist_state: { ...DEFAULT_WISHLIST_STATE },
			set_wishlist_state: (wl) => set(() => ({ wishlist_state: wl })),
			reset_wishlist_state: () =>
				set(() => ({ wishlist_state: { ...DEFAULT_WISHLIST_STATE } })),

			// --- Host dashboard ---
			host_dashboard_state: { ...DEFAULT_HOST_DASHBOARD_STATE },
			set_host_dashboard_state: (hd) =>
				set((state) => ({
					host_dashboard_state: { ...state.host_dashboard_state, ...hd },
				})),
			reset_host_dashboard_state: () =>
				set(() => ({ host_dashboard_state: { ...DEFAULT_HOST_DASHBOARD_STATE } })),

			// --- Review modal ---
			review_modal_state: { ...DEFAULT_REVIEW_MODAL_STATE },
			set_review_modal_state: (rv) =>
				set((state) => ({
					review_modal_state: { ...state.review_modal_state, ...rv },
				})),
			reset_review_modal_state: () =>
				set(() => ({ review_modal_state: { ...DEFAULT_REVIEW_MODAL_STATE } })),

			// --- Realtime/socket ---
			socket_connected: false,
			last_event_received: null,

			connect_socket: (token) => {
				// Only run on client/browser
				if (typeof window === "undefined") return;
				// Disconnect existing
				get().disconnect_socket();
				if (!token) return;
				// Socket URL (from env or fallback)
				const url = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
				const socket: Socket = io(url, {
					auth: { token },
					autoConnect: true,
					transports: ["websocket"],
				});
				// Attach listeners
				socket.on("connect", () => set({ socket_connected: true }));
				socket.on("disconnect", () => set({ socket_connected: false }));
				// Realtime notification: 'notification_new'
				socket.on("notification_new", (payload) => {
					set((state) => ({
						last_event_received: { type: "notification_new", payload },
						notifications: {
							...state.notifications,
							items: [payload, ...state.notifications.items],
							unread_count: (state.notifications.unread_count || 0) + 1,
						},
					}));
				});
				// Messaging: new message in thread
				socket.on("message_new", (payload) => {
					set((state) => {
						// Try to find thread and update preview, unread_count
						let newThreads = state.messaging_threads.threads.slice();
						const idx = newThreads.findIndex(
							(t) => t.thread_id === payload.thread_id,
						);
						if (idx !== -1) {
							const t = newThreads[idx];
							newThreads[idx] = {
								...t,
								last_message_preview: payload.content,
								updated_at: payload.sent_at,
								unread_count: (t.unread_count || 0) + 1,
							};
						}
						return {
							last_event_received: { type: "message_new", payload },
							messaging_threads: { threads: newThreads },
						};
					});
				});
				// Unread change: badge update
				socket.on("thread_unread_update", (payload) => {
					set((state) => {
						let newThreads = state.messaging_threads.threads.slice();
						const idx = newThreads.findIndex(
							(t) => t.thread_id === payload.thread_id,
						);
						if (idx !== -1) {
							newThreads[idx] = {
								...newThreads[idx],
								unread_count: payload.unread_count,
							};
						}
						return {
							last_event_received: { type: "thread_unread_update", payload },
							messaging_threads: { threads: newThreads },
						};
					});
				});
				// Save socket instance (not persisted)
				(get() as any)._socket = socket;
			},

			disconnect_socket: () => {
				// Only on client
				if (typeof window === "undefined") return;
				const store: any = get();
				if (store._socket) {
					store._socket.disconnect();
					store._socket = null;
				}
				set({ socket_connected: false });
			},
		}),
		{
			name: "beachstay-villas-store",
			partialize: (state) => {
				// Don't persist _socket or any unserializable fields
				const { _socket, connect_socket, disconnect_socket, ...rest } = state;
				return rest;
			},
			// Optional: versioning/migration if schema changes
		},
	),
);

// ================
// End of Zustand Store
// ================
