import React, { useEffect, useRef, useCallback, useState } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";

// Helper for status → style
const statusToStyle: Record<
  string,
  { icon: JSX.Element; bg: string; border: string; text: string }
> = {
  success: {
    icon: (
      <svg
        className="w-5 h-5 mr-2 text-green-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
        />
      </svg>
    ),
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-800",
  },
  error: {
    icon: (
      <svg
        className="w-5 h-5 mr-2 text-red-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4m0 4h.01"
        />
      </svg>
    ),
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
  },
  warning: {
    icon: (
      <svg
        className="w-5 h-5 mr-2 text-yellow-600"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M9.93 9.93l-6.36 6.36m15.56-6.36l-6.36 6.36"
        />
      </svg>
    ),
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-800",
  },
  info: {
    icon: (
      <svg
        className="w-5 h-5 mr-2 text-blue-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 16v-4m0-4h.01"
        />
      </svg>
    ),
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-800",
  },
  default: {
    icon: <span className="w-5 h-5 mr-2" />, // blank
    bg: "bg-gray-50",
    border: "border-gray-300",
    text: "text-gray-800",
  },
};

const NOTIFICATION_AUTO_DISMISS_MS = 5200; // 5.2 seconds

// Type aligns with backend (notification_id: string, etc)
interface NotificationItem {
  notification_id: string;
  user_id?: string;
  type: string;
  message: string;
  is_read: boolean;
  reference_id: string | null;
  created_at: string;
}

function notificationTypeToStatus(type: string): "success" | "error" | "warning" | "info" {
  if (!type) return "info";
  const t = type.toLowerCase();
  if (t.includes("success") || t === "booking_confirmed" || t === "message_sent") return "success";
  if (t.includes("error") || t === "booking_failed" || t === "failed") return "error";
  if (t.includes("warn") || t === "warning" || t === "alert") return "warning";
  if (t.includes("info") || t === "message_received") return "info";
  return "info";
}

const GV_NotificationBar: React.FC = () => {
  // Global notification state
  const notifications_items = useAppStore(state => state.notifications.items as NotificationItem[]);
  const notifications_unread_count = useAppStore(state => state.notifications.unread_count);
  const add_notification = useAppStore(state => state.add_notification);
  const mark_notification_read = useAppStore(state => state.mark_notification_read);
  const set_notifications = useAppStore(state => state.set_notifications);
  const user_session = useAppStore(state => state.user_session);

  const [activeIdx, setActiveIdx] = useState<number>(0); // index within local notifications
  const [visible, setVisible] = useState<boolean>(true);
  const [autoDismissTimeout, setAutoDismissTimeout] = useState<NodeJS.Timeout | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Primary notification sorting: unread first, most recent first
  const sortedNotifications = [...notifications_items].sort((a, b) => {
    if (a.is_read === b.is_read) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return a.is_read ? 1 : -1;
  });

  const activeNotification: NotificationItem | null =
    sortedNotifications.length > 0 && visible ? sortedNotifications[activeIdx] : null;

  // --- Axios instance for API
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
    headers: user_session?.token
      ? { Authorization: `Bearer ${user_session.token}` }
      : undefined,
  });

  // --- React Query/mutation: mark notification as read
  const queryClient = useQueryClient();

  // Always use notification_id for backend calls
  const markReadMutation = useMutation({
    mutationFn: async (notification_id: string) => {
      if (!notification_id) throw new Error("Invalid id");
      // Already read: skip
      const notification = notifications_items.find(n => n.notification_id === notification_id);
      if (notification && notification.is_read) return;
      await api.post(`/account/notifications/${notification_id}/read`);
    },
    onSuccess: (_, notification_id) => {
      mark_notification_read(notification_id);
      setTimeout(() => {
        if (activeIdx < sortedNotifications.length - 1) {
          setActiveIdx((i) => i + 1);
          setVisible(true);
        } else {
          setVisible(false);
        }
      }, 180); // slight delay for fade out
    },
    onError: (err: any) => {
      setErrorToast("Error updating notification. Try again.");
      setTimeout(() => setErrorToast(null), 3500);
    },
  });

  // --- Dismiss handler
  const handleDismiss = useCallback(() => {
    if (!activeNotification) return;
    if (!activeNotification.is_read && user_session?.token) {
      markReadMutation.mutate(activeNotification.notification_id);
    } else {
      setTimeout(() => {
        if (activeIdx < sortedNotifications.length - 1) {
          setActiveIdx((i) => i + 1);
          setVisible(true);
        } else {
          setVisible(false);
        }
      }, 80);
    }
  }, [activeNotification, markReadMutation, user_session, activeIdx, sortedNotifications.length]);

  // --- Keyboard: Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.key === "Escape" || e.key === "Esc") &&
        activeNotification &&
        visible
      ) {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeNotification, visible, handleDismiss]);

  // --- Auto-dismiss logic for certain notification types
  useEffect(() => {
    // Dismiss `success`/`info` types automatically
    if (
      activeNotification &&
      visible &&
      ["success", "info"].includes(notificationTypeToStatus(activeNotification.type))
    ) {
      if (autoDismissTimeout) clearTimeout(autoDismissTimeout);
      const timeout = setTimeout(() => {
        handleDismiss();
      }, NOTIFICATION_AUTO_DISMISS_MS);
      setAutoDismissTimeout(timeout as any);
      return () => clearTimeout(timeout);
    }
    if (autoDismissTimeout) clearTimeout(autoDismissTimeout);
    // Not auto-dismiss for others
    // eslint-disable-next-line
  }, [activeNotification, visible, handleDismiss]);

  // --- On notification items change, if none or no more to show, hide
  useEffect(() => {
    if (sortedNotifications.length === 0) {
      setVisible(false);
      setActiveIdx(0);
    } else {
      setActiveIdx(0);
      setVisible(true);
    }
  }, [notifications_items.length]);

  // --- Accessibility: Focus on close button
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (activeNotification && visible && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [activeNotification, visible]);

  // Critical: Adapt all ids/fields from backend shape
  useEffect(() => {
    if (!user_session?.token) return;
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get("/account/notifications");
        if (data && data.items) {
          // No casting of id - use notification_id, reference_id as string|null
          const adapted: NotificationItem[] = data.items.map((n: any) => ({
            notification_id: String(n.notification_id),
            user_id: n.user_id ? String(n.user_id) : undefined,
            type: n.type,
            message: n.message,
            is_read: n.is_read,
            reference_id: n.reference_id === null || typeof n.reference_id === "undefined" ? null : String(n.reference_id),
            created_at: n.created_at,
          }));
          set_notifications({
            items: adapted,
            unread_count: Number(data.unread_count) || 0,
          });
        }
      } catch (e) {
        setErrorToast("Could not retrieve notifications.");
      }
    };
    fetchNotifications();
    // eslint-disable-next-line
  }, [user_session?.token]);

  // --- Render bar (single overlay region, upper right)
  return (
    <>
      {errorToast && (
        <div className="fixed top-2 right-4 z-50 w-auto max-w-sm px-4 py-3 bg-red-100 border border-red-400 text-red-800 rounded shadow-md flex items-center animate-fade">
          <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
          </svg>
          <div className="flex-1 text-sm">{errorToast}</div>
        </div>
      )}

      {activeNotification && visible && (
        <div
          key={activeNotification.notification_id}
          tabIndex={0}
          aria-live="polite"
          aria-atomic="true"
          className={`fixed top-4 right-4 z-[100] max-w-sm min-w-[300px] rounded-lg shadow-2xl transition-all duration-200
            border font-medium
            ${statusToStyle[notificationTypeToStatus(activeNotification.type)]?.bg || statusToStyle.default.bg}
            ${statusToStyle[notificationTypeToStatus(activeNotification.type)]?.border || statusToStyle.default.border}
            ${statusToStyle[notificationTypeToStatus(activeNotification.type)]?.text || statusToStyle.default.text}
            animate-slide-in
          `}
          style={{ outline: "none" }}
          role="status"
        >
          <div className="flex flex-row items-center p-4 pr-2 relative">
            {statusToStyle[notificationTypeToStatus(activeNotification.type)]?.icon || statusToStyle.default.icon}
            <div className="flex-1 text-sm whitespace-pre-line">
              {activeNotification.message}
            </div>
            <button
              onClick={handleDismiss}
              ref={closeBtnRef}
              aria-label="Dismiss notification"
              className="ml-4 p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              tabIndex={0}
            >
              <svg className="w-5 h-5 text-gray-500 hover:text-gray-800" stroke="currentColor" fill="none" viewBox="0 0 20 20" aria-hidden="true">
                <title>Close</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l8 8M6 14L14 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GV_NotificationBar;