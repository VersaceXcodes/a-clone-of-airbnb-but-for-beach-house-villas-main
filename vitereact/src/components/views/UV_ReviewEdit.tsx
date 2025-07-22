import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";
import { userReviewSchema } from "@schema";
import { useAppStore } from "@/store/main";

// --- Types ---
type UserReview = z.infer<typeof userReviewSchema>;

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours in ms
const ONE_HOUR_MS = 60 * 60 * 1000;

const UV_ReviewEdit: React.FC = () => {
  // --- Routing and Store ---
  const { reviewId } = useParams<{ reviewId: string }>();
  const token = useAppStore((state) => state.user_session.token);
  const navigate = useNavigate();

  // --- Component State ---
  const [rating, set_rating] = useState<number>(1); // Default to 1, a valid integer
  const [text, set_text] = useState<string>("");
  const [is_edited, set_is_edited] = useState<boolean>(false);
  const [edit_window_expires_at, set_edit_window_expires_at] = useState<string>("");
  const [is_submitting, set_is_submitting] = useState<boolean>(false);
  const [edit_error, set_edit_error] = useState<string | null>(null);
  const [confirmation_visible, set_confirmation_visible] = useState<boolean>(false);
  const [edit_locked, set_edit_locked] = useState<boolean>(false);

  // --- For warning, compute edit window remaining ---
  const [window_remaining, set_window_remaining] = useState<number>(0);

  // --- QueryClient for cache invalidation ---
  const queryClient = useQueryClient();

  // --- Fetch review for edit ---
  const {
    data: review,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<UserReview, Error>({
    queryKey: ["review", reviewId, token],
    queryFn: async () => {
      if (!reviewId) throw new Error("Invalid review_id");
      const res = await axios.get(`${API_BASE}/review/${reviewId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // Validate with zod
      const parsed = userReviewSchema.safeParse(res.data);
      if (!parsed.success) throw new Error("Malformed review response");
      return parsed.data;
    },
    enabled: !!reviewId && !!token,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    onSuccess: (data) => {
      set_rating(Number.isInteger(data.rating) && data.rating >= 1 && data.rating <= 5 ? data.rating : 1);
      set_text(data.text ?? "");
      set_is_edited(!!data.is_edited);
      set_edit_window_expires_at(data.updated_at ? new Date(data.updated_at).toISOString() : "");
      // Only allow editing within 48h window from updated_at
      const updatedAtMs = data.updated_at ? new Date(data.updated_at).getTime() : 0;
      const now = Date.now();
      const expiresAt = updatedAtMs + EDIT_WINDOW_MS;
      set_window_remaining(expiresAt - now);
      set_edit_locked(now > expiresAt);
      set_edit_error(null);
    },
    onError: (err: any) => {
      set_edit_error("Unable to load review for editing.");
    },
  });

  // --- Update remaining window (for live warning if needed) ---
  useEffect(() => {
    if (edit_window_expires_at) {
      const interval = setInterval(() => {
        const updatedAtMs = new Date(edit_window_expires_at).getTime();
        const expiresAt = updatedAtMs + EDIT_WINDOW_MS;
        const now = Date.now();
        set_window_remaining(expiresAt - now);
        set_edit_locked(now > expiresAt);
      }, 60 * 1000); // every 1 min
      return () => clearInterval(interval);
    }
  }, [edit_window_expires_at]);

  // --- Auth redirect (block UI if not logged in) ---
  useEffect(() => {
    if (!token) {
      navigate("/guest/login?to=" + encodeURIComponent(window.location.pathname), { replace: true });
    }
  }, [token, navigate]);

  // --- PATCH mutation: submit review edit ---
  const mutation = useMutation<UserReview, Error, { rating: number; text: string }>(
    async ({ rating, text }) => {
      if (!reviewId) throw new Error("Missing review id");
      set_is_submitting(true);
      set_edit_error(null);
      // Enforce integer, 1-5
      const safe_rating = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 1;
      const res = await axios.patch(
        `${API_BASE}/review/${reviewId}`,
        { rating: safe_rating, text },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      // zod
      const parsed = userReviewSchema.safeParse(res.data);
      if (!parsed.success) throw new Error("Malformed response on save");
      return parsed.data;
    },
    {
      onSuccess: (data) => {
        set_confirmation_visible(true);
        set_edit_locked(true);
        set_is_edited(true);
        set_is_submitting(false);
        set_rating(data.rating);
        set_text(data.text ?? "");
        set_edit_error(null);
        // Optionally, refetch reviews cache elsewhere (e.g., trip, villa, my_reviews)
        queryClient.invalidateQueries({ queryKey: ["review", reviewId] });
        queryClient.invalidateQueries({ queryKey: ["my_reviews"] });
      },
      onError: (err: any) => {
        set_is_submitting(false);
        if (err?.response?.data?.error) set_edit_error(err.response.data.error);
        else set_edit_error("Failed to update review. Please try again.");
      },
    }
  );

  // --- Derived: how much time is left in the window? ---
  const minutes_left = window_remaining > 0 ? Math.floor(window_remaining / (60 * 1000)) : 0;
  const hours_left = window_remaining > 0 ? Math.floor(window_remaining / (60 * 60 * 1000)) : 0;

  // --- Handlers ---
  const handle_rating = (num: number) => {
    if (!edit_locked && !is_submitting) {
      if (Number.isInteger(num) && num >= 1 && num <= 5) {
        set_rating(num);
      }
    }
  };
  const handle_text = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!edit_locked && !is_submitting) set_text(e.target.value);
  };
  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (edit_locked || is_submitting) return;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      set_edit_error("Rating must be an integer between 1 and 5.");
      return;
    }
    if (text.trim().length === 0) {
      set_edit_error("Review text cannot be empty.");
      return;
    }
    set_edit_error(null);
    mutation.mutate({ rating, text: text.trim() });
  };

  // --- Form + UI ---
  return (
    <>
      <div className="max-w-xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-6 text-center">Edit Your Review</h1>
        {/* Loading/error states */}
        {isLoading && (
          <div className="flex flex-col items-center py-12">
            <span className="animate-spin rounded-full h-10 w-10 border-4 border-t-primary-500 border-gray-200"></span>
            <p className="mt-2 text-gray-600">Loading review...</p>
          </div>
        )}

        {edit_error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mb-4">
            {edit_error}
          </div>
        )}

        {isError && (
          <div className="bg-red-100 text-red-700 px-4 py-4 rounded shadow mb-8">
            <p>
              Unable to load review. The review may not exist, or you may not have access.
            </p>
            <Link
              to="/guest/my-trips"
              className="mt-4 inline-block underline text-primary-600"
            >
              Back to My Trips
            </Link>
          </div>
        )}

        {!isLoading && review && (
          <>
            {/* Edit window banner and warnings */}
            <div className="mb-4">
              {edit_locked ? (
                <div className="flex items-center text-yellow-700 bg-yellow-100 border border-yellow-200 px-4 py-3 rounded mb-1">
                  <svg className="w-5 h-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
                  </svg>
                  <span>
                    The 48-hour edit window for this review has expired. You cannot make further changes.
                  </span>
                </div>
              ) : (
                <div className="flex items-center text-blue-800 bg-blue-100 border border-blue-200 px-4 py-3 rounded mb-1">
                  <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
                  </svg>
                  <span>
                    You may edit your review within <b>48 hours</b> after posting.{" "}
                    {minutes_left > 0 && (
                      <span>
                        {hours_left > 0 ? (
                          <>
                            <b>{hours_left}</b> hour{hours_left !== 1 && "s"}
                          </>
                        ) : (
                          <>
                            <span className="text-red-700"><b>{minutes_left}</b> minutes</span>
                          </>
                        )}{" "}
                        remaining.
                      </span>
                    )}
                  </span>
                </div>
              )}
              {window_remaining > 0 && window_remaining < ONE_HOUR_MS && !edit_locked && (
                <div className="mt-2 text-sm bg-red-50 text-red-800 p-2 rounded border border-red-200">
                  Warning: Less than 1 hour left to edit your review.
                </div>
              )}
              {is_edited && (
                <span className="inline-flex items-center bg-gray-100 border border-gray-300 rounded px-2 py-0.5 ml-1 text-xs text-gray-700 ml-0.5">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M5 9V7a4 4 0 114 4h-2a2 2 0 11-2-2h2V9a2 2 0 11-2-2v2H7a4 4 0 11-4-4h2a2 2 0 112-2H5a4 4 0 110 8z"></path></svg>
                  Edited
                </span>
              )}
            </div>

            {/* Confirmation state */}
            {confirmation_visible && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-4 rounded mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="font-semibold mb-0.5">Your review has been updated.</p>
                  <p className="text-sm">
                    Thank you!{" "}
                    <Link
                      to="/guest/my-trips"
                      className="underline text-green-700 ml-1"
                    >
                      Back to My Trips
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {/* Main edit form */}
            <form onSubmit={handle_submit} className={`space-y-7 mt-6 ${edit_locked || confirmation_visible ? "opacity-60 pointer-events-none select-none" : ""}`}>
              {/* Star Rating */}
              <div>
                <label className="block font-semibold mb-2">Your rating</label>
                <div className="flex items-center space-x-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`Set rating ${star}`}
                      className={`p-0.5 transition ${
                        star <= rating
                          ? "text-yellow-400"
                          : "text-gray-300 hover:text-yellow-300"
                      }`}
                      disabled={edit_locked || is_submitting}
                      onClick={() => handle_rating(star)}
                      tabIndex={edit_locked ? -1 : 0}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-7 h-7"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.222 3.764a1 1 0 00.95.69h3.963c.969 0 1.371 1.24.588 1.81l-3.206 2.33a1 1 0 00-.364 1.118l1.222 3.764c.3.921-.755 1.688-1.539 1.118l-3.206-2.33a1 1 0 00-1.175 0l-3.206 2.33c-.783.57-1.838-.197-1.539-1.118l1.222-3.764a1 1 0 00-.364-1.118l-3.206-2.33c-.783-.57-.38-1.81.588-1.81h3.963a1 1 0 00.95-.69l1.222-3.764z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text */}
              <div>
                <label htmlFor="review-content" className="block font-semibold mb-2">
                  Review text
                </label>
                <textarea
                  id="review-content"
                  rows={6}
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 placeholder-gray-400"
                  placeholder="Share your experience of your stay..."
                  value={text}
                  onChange={handle_text}
                  disabled={edit_locked || is_submitting}
                  maxLength={4096}
                  minLength={10}
                  required
                />
                <div className="flex justify-end mt-1 text-xs text-gray-500">
                  {text.length}/4096 characters
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center space-x-4 mt-4">
                <button
                  type="submit"
                  className={`bg-primary-600 text-white rounded font-bold px-6 py-2 shadow hover:bg-primary-700 focus:outline-none transition ${
                    is_submitting ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  disabled={edit_locked || is_submitting || confirmation_visible}
                  aria-disabled={edit_locked || is_submitting || confirmation_visible}
                >
                  {is_submitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin w-5 h-5 mr-2 text-white inline" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </button>

                <Link
                  to="/guest/my-trips"
                  className="rounded px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium border border-gray-200"
                  tabIndex={0}
                >
                  Cancel
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
};

export default UV_ReviewEdit;