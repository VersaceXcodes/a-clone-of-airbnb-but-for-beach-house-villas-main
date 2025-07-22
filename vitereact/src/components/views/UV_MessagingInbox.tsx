import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";
import { Link } from "react-router-dom";
import { z } from "zod";

// -- Types from Zod schema and Zustand
// Corrected: All IDs should be string, last_message_preview should allow null.
type MessageThread = {
  thread_id: string;
  participant_user_id: string;
  villa_id: string | null;
  booking_id: string | null;
  last_message_preview: string | null;
  unread_count: number;
  updated_at: string;
};

type UserSession = {
  user_id: string | null;
  is_authenticated: boolean;
  is_host: boolean;
  token: string | null;
  display_name: string | null;
  profile_photo_url: string | null;
  superhost_status: boolean;
  unread_message_count: number;
  last_active_at: string | null;
};

const INBOX_QUERY_KEY = ["inbox_threads"];

const fetchInboxThreads = async (token: string): Promise<MessageThread[]> => {
  const { data } = await axios.get<MessageThread[]>(
    `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/inbox`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  // Defensive: Coerce number IDs to string if backend returns mistakes
  return Array.isArray(data) ? data.map((thread) => ({
    ...thread,
    thread_id: String(thread.thread_id),
    participant_user_id: String(thread.participant_user_id),
    villa_id: thread.villa_id !== null && thread.villa_id !== undefined ? String(thread.villa_id) : null,
    booking_id: thread.booking_id !== null && thread.booking_id !== undefined ? String(thread.booking_id) : null,
    last_message_preview: thread.last_message_preview ?? null,
  })) : [];
};

// --- ErrorBoundary for robustness ---
class InboxErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("Inbox ErrorBoundary caught", error, errorInfo);
    }
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// -- Main Component --
const UV_MessagingInbox: React.FC = () => {
  // --- Zustand selectors ---
  const token = useAppStore((s) => s.user_session.token);
  const user_id = useAppStore((s) => s.user_session.user_id);
  const messaging_threads = useAppStore((s) => s.messaging_threads.threads);
  const set_messaging_threads = useAppStore((s) => s.set_messaging_threads);

  const [search_query, set_search_query] = useState<string>("");

  const {
    isLoading: is_inbox_loading,
    isError,
    error,
    data: threadsData,
    refetch,
  } = useQuery<MessageThread[], Error>({
    queryKey: INBOX_QUERY_KEY,
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return fetchInboxThreads(token);
    },
    enabled: !!token, // Only request if authenticated
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    onSuccess: (data) => {
      set_messaging_threads({ threads: data });
    },
  });

  const threads: MessageThread[] = useMemo(
    () => messaging_threads && Array.isArray(messaging_threads) ? messaging_threads : [],
    [messaging_threads]
  );

  // --- Filtered threads ---
  // Requirements note: Can't search by participant display name or villa title without additional API/data, so fallback to current data
  const filtered_threads = useMemo(() => {
    if (!search_query.trim()) return threads;
    const q = search_query.trim().toLowerCase();
    return threads.filter((t) => {
      const userStr = `user ${t.participant_user_id}`.toLowerCase();
      const villaStr = t.villa_id !== null ? `villa ${t.villa_id}`.toLowerCase() : "";
      const bookingStr = t.booking_id !== null ? `booking ${t.booking_id}`.toLowerCase() : "";
      return (
        userStr.includes(q) ||
        String(t.participant_user_id).toLowerCase().includes(q) ||
        villaStr.includes(q) ||
        String(t.villa_id || "").toLowerCase().includes(q) ||
        bookingStr.includes(q) ||
        String(t.booking_id || "").toLowerCase().includes(q) ||
        (t.last_message_preview && t.last_message_preview.toLowerCase().includes(q))
      );
    });
  }, [search_query, threads]);

  useEffect(() => {
    if (token && (!messaging_threads || messaging_threads.length === 0)) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      set_search_query(e.target.value);
    },
    []
  );

  const toRelativeTime = (iso: string): string => {
    const now = Date.now();
    const t = new Date(iso).getTime();
    const diff = Math.floor((now - t) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 3 * 86400) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <InboxErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-red-600">
          <svg width={64} height={64} fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
            <path d="M8 8l8 8M16 8l-8 8" stroke="#ef4444" strokeWidth="2" />
          </svg>
          <div className="mt-2 font-semibold text-lg">Sorry, something went wrong loading your inbox.</div>
          <button
            className="mt-2 px-4 py-2 bg-rose-500 text-white rounded hover:bg-rose-600"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      }
    >
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-16">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1 text-gray-800">Inbox</h1>
            <div className="text-gray-500">Your guest-host conversations</div>
          </div>
          <div>
            <Link
              to="/search"
              className="inline-flex items-center px-4 py-1.5 rounded bg-sky-100 text-sky-700 hover:bg-sky-200 hover:text-sky-900 font-medium transition text-sm"
              title="Start a conversation"
            >
              <span className="mr-2">Start New</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5v14m7-7H5" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </Link>
          </div>
        </div>
        {/* Search box */}
        <div className="mb-8">
          <input
            type="text"
            autoComplete="off"
            className="w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-sky-300 transition"
            placeholder="Search by user, villa, or keywords..."
            value={search_query}
            onChange={handleSearchChange}
            aria-label="Search message threads"
          />
        </div>

        {/* Loading/Error State, fallback errors only catch JS errors, not data loading errors */}
        {is_inbox_loading ? (
          <div className="flex justify-center items-center py-24">
            <svg className="animate-spin h-9 w-9 text-sky-500" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
              />
            </svg>
            <span className="ml-4 text-gray-500 text-lg">Loading your messages...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-rose-600">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
              <path d="M8 8l8 8M16 8l-8 8" stroke="#ef4444" strokeWidth="2" />
            </svg>
            <div className="mt-2">Could not load messages.</div>
            <button
              className="mt-2 px-4 py-2 bg-rose-500 text-white rounded hover:bg-rose-600"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        ) : (
          filtered_threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <img
                src="https://picsum.photos/seed/inboxempty/180/100"
                className="mb-4 rounded"
                alt="No messages"
                width={180}
                height={100}
                style={{ objectFit: "cover" }}
              />
              <div className="font-semibold text-lg mb-2">No conversations yet.</div>
              <div className="text-sm mb-4 text-center max-w-xs">
                Your messages with hosts and guests will appear here.<br />
                Once you contact someone on a villa page or have a booking, you'll find your conversations here.
              </div>
              <Link
                to="/search"
                className="mt-1 px-4 py-2 rounded bg-sky-200 text-sky-800 hover:bg-sky-300 font-medium transition"
              >
                <span>Find a beach villa</span>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 shadow bg-white">
              {filtered_threads.map((t) => (
                <li key={t.thread_id} className="block hover:bg-sky-50 transition">
                  <Link
                    to={`/messaging/thread/${encodeURIComponent(t.thread_id)}`}
                    className="flex items-center gap-3 px-3 py-4 focus:outline-none"
                  >
                    {/* User avatar fake */}
                    <div className="flex-shrink-0">
                      <img
                        src={`https://picsum.photos/seed/user${t.participant_user_id}/48`}
                        className="h-11 w-11 rounded-full object-cover bg-gray-200 border border-gray-300"
                        alt={`User #${t.participant_user_id} avatar`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-base">
                          User #{t.participant_user_id}
                        </span>
                        {t.villa_id ? (
                          <span className="ml-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs">
                            Villa #{t.villa_id}
                          </span>
                        ) : null}
                        {t.booking_id ? (
                          <span className="ml-2 px-2 py-0.5 rounded bg-sky-50 text-sky-700 text-xs">
                            Booking #{t.booking_id}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-gray-500 text-sm flex items-center truncate mt-0.5">
                        {t.last_message_preview ? (
                          <span className="truncate">{t.last_message_preview}</span>
                        ) : (
                          <span className="italic">No messages yet</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end pl-2">
                      <span className="text-xs text-gray-400 font-mono mt-1 mb-2">
                        {toRelativeTime(t.updated_at)}
                      </span>
                      {t.unread_count > 0 && (
                        <span className="inline-block rounded-full bg-rose-500 text-white px-2 text-xs font-semibold min-w-[1.2rem] text-center">
                          {t.unread_count}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </InboxErrorBoundary>
  );
};

export default UV_MessagingInbox;