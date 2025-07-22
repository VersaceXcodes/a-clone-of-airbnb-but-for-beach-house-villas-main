import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";

// Zod: types for type-safety (Message, MessageThread)
import type { MessageThread as StoreMessageThread } from "@/store/main";
import { z } from "zod";

const MessageSchema = z.object({
  message_id: z.string(),
  thread_id: z.string(),
  sender_user_id: z.string(),
  recipient_user_id: z.string(),
  content: z.string(),
  is_read: z.boolean(),
  sent_at: z.union([z.string(), z.date()]),
});
type Message = z.infer<typeof MessageSchema>;

// --- Util: API base url ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return date.toLocaleString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const UV_MessagingThread: React.FC = () => {
  // --- Get thread_id from route ---
  const params = useParams();
  const navigate = useNavigate();
  // Accept both `threadId` (camel) and `thread_id` (snake)
  const threadIdParam = params.threadId || params.thread_id;
  // OpenAPI: thread_id should be number in path
  let _thread_id = threadIdParam && typeof threadIdParam === "string" ? threadIdParam : "";
  let thread_id_numeric: number | null = null;
  if (_thread_id && !isNaN(Number(_thread_id))) {
    thread_id_numeric = Number(_thread_id);
  }
  const thread_id = _thread_id;

  // ========== ZUSTAND GLOBAL STATE ==============
  const user_session = useAppStore((s) => s.user_session);
  const messaging_threads = useAppStore((s) => s.messaging_threads);
  const connect_socket = useAppStore((s) => s.connect_socket);
  const socket_connected = useAppStore((s) => s.socket_connected);
  const last_event_received = useAppStore((s) => s.last_event_received);
  // Optionally we could also manage messages in global state:
  const set_thread_messages = useAppStore((s) => s.set_thread_messages);

  // --- Fetch thread meta (from global state, fallback to null) ---
  const [threadMeta, setThreadMeta] = useState<StoreMessageThread | null>(null);
  useEffect(() => {
    const globalMeta =
      messaging_threads.threads.find(
        (t) => String(t.thread_id) === String(thread_id)
      ) || null;
    setThreadMeta(globalMeta);
  }, [thread_id, messaging_threads.threads]);

  // --- Local messaging state, but synchronize with store if available ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState<boolean>(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // --- Compose input ---
  const [newMessage, setNewMessage] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // --- Ref for auto-scroll ---
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
    }
  }, [messages.length]);

  // --- Server: Fetch both messages + thread meta ---
  const fetchThreadMessages = async () => {
    if (!user_session.token) throw new Error("Not authenticated");
    if (!thread_id_numeric) throw new Error("Thread ID numeric required");
    const resp = await axios.get(
      `${API_BASE}/inbox/${thread_id_numeric}`,
      {
        headers: {
          Authorization: `Bearer ${user_session.token}`,
        },
      }
    );
    if (!Array.isArray(resp.data)) {
      throw new Error("Unexpected server response");
    }
    // Validate all messages
    const validated = resp.data.map((m: any) => {
      const parsed = MessageSchema.safeParse(m);
      if (parsed.success) return parsed.data;
      throw new Error("Invalid message object from backend");
    });
    // Try read thread meta (from first message + global)
    if (validated.length > 0) {
      // Rehydrate minimal thread meta if missing
      if (!threadMeta) {
        // We can't get all meta from message, but can set knowns
        setThreadMeta({
          thread_id: validated[0].thread_id,
          villa_id: null,
          booking_id: null,
          participant_user_id: null,
          last_message_preview: validated[validated.length - 1].content || "",
          unread_count: 0,
          updated_at: validated[validated.length - 1].sent_at,
        } as StoreMessageThread);
      } else {
        // Optionally update updated_at + last_message_preview if differing
        if (threadMeta.updated_at !== validated[validated.length - 1].sent_at) {
          setThreadMeta({ ...threadMeta, updated_at: validated[validated.length - 1].sent_at });
        }
      }
    }
    // Sync with store:
    if (typeof set_thread_messages === "function") {
      set_thread_messages(thread_id, validated);
    }
    return validated;
  };

  // --- useQuery for initial load; re-fetch on thread_id or login change ---
  const {
    data: messagesData,
    isLoading: queryLoading,
    isError: queryIsError,
    error: queryError,
    refetch: refetchMessages,
  } = useQuery<Message[], Error>({
    queryKey: ["threadMessages", thread_id, user_session.token],
    queryFn: fetchThreadMessages,
    enabled: !!thread_id_numeric && !!user_session.is_authenticated,
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (messagesData) {
      setMessages(messagesData);
      setMessagesError(null);
      setMessagesLoading(false);
    }
    if (queryIsError) {
      setMessages([]);
      setMessagesError(queryError?.message || "Could not load messages.");
      setMessagesLoading(false);
    }
    if (queryLoading) {
      setMessagesLoading(true);
    }
  }, [messagesData, queryIsError, queryError, queryLoading]);

  // --- WebSocket connection/subscribe to relevant events (on mount) ---
  useEffect(() => {
    if (user_session.token) {
      connect_socket(user_session.token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user_session.token]);

  // --- Append incoming websocket messages if relevant (from global store) ---
  useEffect(() => {
    if (
      last_event_received &&
      last_event_received.type === "message_new" &&
      last_event_received.payload &&
      String(last_event_received.payload.thread_id) === String(thread_id)
    ) {
      const incoming = last_event_received.payload;
      const parsed = MessageSchema.safeParse(incoming);
      if (parsed.success) {
        setMessages((prevMessages) => {
          if (prevMessages.some((m) => m.message_id === parsed.data.message_id)) return prevMessages;
          const messagesNext = [...prevMessages, parsed.data].sort(
            (a, b) =>
              new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
          );
          // Update store if available
          if (typeof set_thread_messages === "function") {
            set_thread_messages(thread_id, messagesNext);
          }
          return messagesNext;
        });
      }
    }
  }, [last_event_received, thread_id, set_thread_messages]);

  const queryClient = useQueryClient();
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user_session.token)
        throw new Error("Not authenticated; login to send messages.");
      if (!content.trim())
        throw new Error("Cannot send an empty message.");
      if (!thread_id_numeric) throw new Error("Thread ID numeric required");
      const resp = await axios.post<Message>(
        `${API_BASE}/inbox/${thread_id_numeric}`,
        { content },
        {
          headers: {
            Authorization: `Bearer ${user_session.token}`,
          },
        }
      );
      const parsed = MessageSchema.safeParse(resp.data);
      if (!parsed.success) throw new Error("Invalid message data from server.");
      return parsed.data;
    },
    onMutate: () => {
      setIsSending(true);
      setSendError(null);
    },
    onSuccess: (msg) => {
      setMessages((prev) => {
        const messagesNext = [...prev, msg].sort(
          (a, b) =>
            new Date(a.sent_at).getTime() -
            new Date(b.sent_at).getTime()
        );
        if (typeof set_thread_messages === "function") {
          set_thread_messages(thread_id, messagesNext);
        }
        return messagesNext;
      });
      setNewMessage("");
      setIsSending(false);
      setSendError(null);
    },
    onError: (e: any) => {
      setIsSending(false);
      setSendError(e?.message || "Could not send message.");
    },
    onSettled: () => {
      setIsSending(false);
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || !newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && newMessage.trim()) {
        sendMessageMutation.mutate(newMessage);
      }
    }
  };

  const handleGoLogin = () => {
    navigate("/guest/login");
  };

  const renderContextBanner = () => {
    const meta = threadMeta;
    if (!meta)
      return (
        <div className="bg-gray-100 rounded-lg p-4 mb-3 text-gray-700 text-center">
          <span>Conversation: Unknown context</span>
        </div>
      );
    return (
      <div className="bg-blue-50 rounded-lg p-4 mb-3 flex flex-wrap items-center justify-between">
        <div className="flex flex-col">
          <span className="font-medium text-blue-900">
            {meta.booking_id !== null && meta.booking_id !== undefined ? (
              <>
                <span>
                  Booking conversation 
                  <Link
                    to={`/reservation/${meta.booking_id}`}
                    className="text-blue-700 underline"
                  >
                    (view reservation)
                  </Link>
                </span>
              </>
            ) : meta.villa_id !== null && meta.villa_id !== undefined ? (
              <>
                <span>
                  Inquiry for 
                  <Link
                    to={`/villa/${meta.villa_id}`}
                    className="text-blue-700 underline"
                  >
                    villa #{meta.villa_id}
                  </Link>
                </span>
              </>
            ) : (
              <span>Direct message conversation</span>
            )}
          </span>
          <span className="text-xs text-blue-600 mt-1">
            Updated: {formatDate(meta.updated_at || new Date())}
          </span>
        </div>
        {/* Pre-book CTA if inquiry only */}
        {meta.booking_id === null && meta.villa_id !== null && meta.villa_id !== undefined ? (
          <Link
            to={`/villa/${meta.villa_id}`}
            className="ml-2 inline-block rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition"
          >
            Book Now
          </Link>
        ) : null}
      </div>
    );
  };

  const isAuthenticated = !!user_session && !!user_session.token && !!user_session.is_authenticated;
  const myUserId = typeof user_session.user_id === "number" ? String(user_session.user_id) : user_session.user_id || "";

  const [fatalError, setFatalError] = useState<string | null>(null);
  let renderError: string | null = fatalError;
  try {
    if (!thread_id) renderError = "Thread not specified";
  } catch (renderEx: any) {
    renderError = renderEx?.message || "Unknown error";
  }

  return (
    <>
      {/* Error boundary */}
      {renderError ? (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="text-red-600 text-2xl font-semibold mb-3">Error</div>
          <div className="mb-6 text-gray-700">{renderError}</div>
          <button
            className="bg-blue-600 text-white rounded px-4 py-2"
            onClick={() => (window.location.href = "/inbox")}
          >
            Back to Inbox
          </button>
        </div>
      ) : !isAuthenticated ? (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="text-blue-600 text-xl font-semibold mb-3">
            Sign in to view or send messages.
          </div>
          <div className="mb-6 text-gray-700">
            Please{" "}
            <button
              className="underline text-blue-700"
              type="button"
              onClick={handleGoLogin}
            >
              login
            </button>{" "}
            to continue.
          </div>
        </div>
      ) : (
        <div className="max-w-2xl flex flex-col mx-auto h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] p-2 relative">
          {/* Context banner */}
          {renderContextBanner()}

          {/* MESSAGES */}
          <div
            className="flex-1 overflow-y-auto w-full pb-3"
            style={{ scrollbarWidth: "thin" }}
          >
            {messagesLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-slate-100 rounded-lg h-8 w-3/4 mx-auto"
                  />
                ))}
              </div>
            ) : messagesError ? (
              <div className="text-red-500 p-4 text-center">
                {messagesError}
                <button
                  className="ml-3 text-blue-700 underline"
                  onClick={() => refetchMessages()}
                >
                  Retry
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-gray-500 text-center">
                <div className="text-4xl mb-2">💬</div>
                No messages yet in this conversation.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {messages
                  .sort(
                    (a, b) =>
                      new Date(a.sent_at).getTime() -
                      new Date(b.sent_at).getTime()
                  )
                  .map((msg, i) => {
                    const isMine =
                      myUserId && String(msg.sender_user_id) === String(myUserId);
                    return (
                      <div
                        key={msg.message_id}
                        className={`flex ${
                          isMine
                            ? "justify-end items-end"
                            : "justify-start items-start"
                        }`}
                      >
                        <div
                          className={`relative max-w-[80%] px-4 py-2 rounded-lg shadow ${
                            isMine
                              ? "bg-blue-600 text-white ml-8"
                              : "bg-gray-100 text-gray-900 mr-8"
                          }`}
                        >
                          <div className="whitespace-pre-line break-words">
                            {msg.content}
                          </div>
                          <div
                            className={`absolute -bottom-5 right-2 text-xs text-gray-400 select-none ${
                              isMine ? "text-white/70" : "text-gray-500"
                            }`}
                          >
                            {formatDate(msg.sent_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* COMPOSE (fixed at bottom) */}
          <div className="sticky bottom-0 left-0 bg-white py-2 px-1 mt-1 border-t border-gray-200">
            <form
              className="flex gap-2 items-end"
              onSubmit={handleSendMessage}
              autoComplete="off"
            >
              <label htmlFor="msgTextarea" className="sr-only">Type your message</label>
              <textarea
                id="msgTextarea"
                className="flex-1 border rounded-md px-2 py-2 resize-none min-h-[38px] max-h-24 text-base bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 ring-blue-100"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={onTextareaKeyDown}
                rows={1}
                placeholder="Type your message…"
                disabled={isSending || !isAuthenticated}
                tabIndex={0}
                autoFocus
                aria-label="Type your message"
                spellCheck={true}
              />
              <button
                type="submit"
                className={`rounded inline-flex items-center px-5 py-2 font-semibold text-sm bg-blue-700 text-white disabled:bg-blue-300 transition`}
                disabled={
                  isSending ||
                  !isAuthenticated ||
                  !(newMessage.trim().length > 0)
                }
                tabIndex={0}
                aria-label="Send message"
              >
                {isSending ? (
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-b-transparent rounded-full"></span>
                ) : null}
                Send
              </button>
            </form>
            {sendError ? (
              <div className="text-red-600 text-sm mt-2">{sendError}</div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
};

export default UV_MessagingThread;