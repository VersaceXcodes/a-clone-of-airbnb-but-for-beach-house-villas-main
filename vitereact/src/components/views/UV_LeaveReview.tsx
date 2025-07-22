import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useAppStore } from "@/store/main";

// --- Types from Zod Schemas (for type safety) ---
type ReviewCreate = {
  booking_id: number;
  rating: number;
  text: string;
};

type UserReview = {
  review_id: string;
  booking_id: string;
  guest_user_id: string;
  villa_id: string;
  host_user_id: string;
  rating: number;
  text: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
};

const MIN_COMMENT_LEN = 25;

const UV_LeaveReview: React.FC = () => {
  // Get booking_id from URL params, and decode as string
  const params = useParams<{ bookingId: string }>();
  // Coerce booking_id to integer for backend
  const booking_id_param = params.bookingId ?? "";
  const booking_id_num = booking_id_param && !Number.isNaN(Number(booking_id_param)) ? Number(booking_id_param) : null;

  // Zustand store: user session for auth
  const user_session = useAppStore((state) => state.user_session);

  // --- Form State ---
  const [rating, set_rating] = useState<number>(0);
  const [text, set_text] = useState<string>("");
  const [confirmation_visible, set_confirmation_visible] = useState(false);

  // --- UI Feedback ---
  const [submit_error, set_submit_error] = useState<string | null>(null);
  const [is_submitting, set_is_submitting] = useState<boolean>(false);

  // --- Derived State ---
  const is_logged_in = user_session?.is_authenticated && !!user_session.token;
  const is_valid =
    is_logged_in &&
    !!booking_id_num &&
    rating >= 1 &&
    rating <= 5 &&
    text.trim().length >= MIN_COMMENT_LEN;

  // --- Review Submit Mutation ---
  const submitReviewMutation = useMutation<UserReview, Error, ReviewCreate>({
    mutationFn: async (data) => {
      const apiBase =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      // POST /booking/{booking_id}/review
      const response = await axios.post(
        `${apiBase}/booking/${encodeURIComponent(data.booking_id)}/review`,
        {
          booking_id: data.booking_id,
          rating: data.rating,
          text: data.text.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${user_session.token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    },
    onMutate: () => {
      set_is_submitting(true);
    },
    onSuccess: () => {
      set_confirmation_visible(true);
      set_submit_error(null);
    },
    onError: (error: any) => {
      let err: string = "Something went wrong.";
      if (
        error &&
        error.response &&
        typeof error.response.data?.error === "string"
      ) {
        err = error.response.data.error;
      }
      set_submit_error(err);
    },
    onSettled: () => {
      set_is_submitting(false);
    }
  });

  // --- Handle Submit ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    set_submit_error(null);
    if (!is_valid) {
      set_submit_error(
        !rating
          ? "Please select a star rating (1–5)."
          : text.trim().length < MIN_COMMENT_LEN
          ? `Comment must be at least ${MIN_COMMENT_LEN} characters.`
          : !is_logged_in
          ? "You must be logged in to leave a review."
          : "Invalid form. Check fields."
      );
      return;
    }
    if (!booking_id_num) {
      set_submit_error("Invalid booking reference.");
      return;
    }
    submitReviewMutation.mutate({ booking_id: booking_id_num, rating, text: text.trim() });
  };

  // -- Star Rating Render Helper (inline) --
  // We render a row of five interactive stars.
  const renderStars = () => (
    <div className="flex flex-row items-center gap-2 mt-1">
      {[1, 2, 3, 4, 5].map((starVal) => (
        <button
          key={starVal}
          type="button"
          className={`p-1 focus:outline-none ${
            rating >= starVal
              ? "text-yellow-400"
              : "text-gray-300 hover:text-yellow-300"
          }`}
          aria-label={`Rate ${starVal} star${starVal !== 1 ? "s" : ""}`}
          disabled={confirmation_visible || is_submitting}
          onClick={() => set_rating(starVal)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill={rating >= starVal ? "currentColor" : "none"}
            className="h-8 w-8 transition-all"
            stroke="currentColor"
            strokeWidth={rating >= starVal ? 0 : 1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.437 4.402a1 1 0 00.95.69h4.624c.969 0 1.371 1.24.588 1.81l-3.742 2.718a1 1 0 00-.364 1.118l1.437 4.402c.299.921-.755 1.688-1.539 1.118l-3.742-2.718a1 1 0 00-1.176 0l-3.742 2.718c-.783.57-1.838-.197-1.539-1.118l1.437-4.402a1 1 0 00-.364-1.118L2.44 9.829c-.783-.57-.38-1.81.588-1.81h4.624a1 1 0 00.95-.69l1.437-4.402z"
            />
          </svg>
        </button>
      ))}
    </div>
  );

  // --- Initial Param/State checks ---
  if (!booking_id_param) {
    // missing param
    return (
      <>
        <div className="max-w-xl mx-auto pt-16 pb-24 px-4">
          <div className="rounded-md bg-red-50 border border-red-200 p-5 text-red-700 text-lg font-semibold shadow">
            Error: No booking selected for review.
          </div>
          <div className="mt-6">
            <Link
              to="/guest/my-trips"
              className="underline text-blue-700 hover:text-blue-500"
            >
              Return to My Trips
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!is_logged_in) {
    // not authenticated
    return (
      <>
        <div className="max-w-xl mx-auto pt-16 pb-24 px-4">
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-5 text-yellow-800 text-lg font-semibold shadow">
            You must be logged in to leave a review.
          </div>
          <div className="mt-6">
            <Link
              to="/guest/login"
              className="underline text-blue-700 hover:text-blue-500"
            >
              Log In
            </Link>
            <span> or </span>
            <Link
              to="/guest/signup"
              className="underline text-blue-700 hover:text-blue-500"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </>
    );
  }

  // --- Main Form / Confirmation ---
  return (
    <>
      <div className="max-w-2xl mx-auto pt-10 pb-20 px-4">
        <div className="border-b border-gray-200 pb-6 mb-10">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Leave a Review
          </h1>
          <p className="mt-2 text-gray-600">
            Thanks for staying!
            <br />
            Share your experience: leave a star rating (1–5) and at least{" "}
            {MIN_COMMENT_LEN} characters of feedback. You may edit your review within 48 hours after submission.
          </p>
        </div>

        {submit_error && (
          <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-2 text-red-700">
            <span className="font-semibold">Error:</span> {submit_error}
          </div>
        )}

        {/* Confirmation display */}
        {confirmation_visible ? (
          <div className="w-full bg-green-50 border border-green-200 rounded-xl py-8 px-5 text-center shadow mt-8">
            <div className="flex flex-col items-center justify-center gap-3">
              <svg
                className="w-14 h-14 text-green-400 mb-2"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12l2.5 2.5L16 9"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  fill="none"
                />
              </svg>
              <h2 className="font-bold text-green-700 text-2xl">
                Thank you for your review!
              </h2>
              <p className="text-green-700 font-medium mb-3">
                Your feedback helps future guests and hosts.
                <br />
                You can edit your review for up to 48 hours from now from your
                trips list.
              </p>
              <div className="flex justify-center gap-4 mt-2">
                <Link
                  to="/guest/my-trips"
                  className="inline-block rounded px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                >
                  Back to My Trips
                </Link>
                <Link
                  to="/"
                  className="inline-block rounded px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 font-semibold"
                >
                  Home
                </Link>
              </div>
            </div>
          </div>
        ) : (
          // Form
          <form
            className="max-w-2xl mx-auto flex flex-col gap-5 bg-white shadow border border-gray-100 rounded-xl p-7"
            onSubmit={handleSubmit}
            aria-disabled={confirmation_visible}
          >
            <label className="block mb-0.5 font-semibold text-gray-800 text-lg">
              Star Rating <span className="text-red-500">*</span>
            </label>
            {renderStars()}
            <span
              className={`text-sm mt-1 ${
                rating >= 1
                  ? "text-green-600 font-medium"
                  : "text-gray-400"
              }`}
            >
              {rating > 0
                ? ["1 (Very poor)", "2 (Poor)", "3 (Average)", "4 (Very good)", "5 (Excellent)"][rating - 1]
                : "Select a rating"}
            </span>

            <label
              htmlFor="review_comment"
              className="block mb-0.5 font-semibold text-gray-800 text-lg mt-5"
            >
              Your Review <span className="text-red-500">*</span>
            </label>
            <textarea
              id="review_comment"
              rows={6}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-lg focus:outline-none focus:ring focus:border-blue-300 resize-none disabled:opacity-60"
              maxLength={4096}
              minLength={MIN_COMMENT_LEN}
              placeholder="Share your thoughts: what you loved, tips for future guests, or improvements..."
              value={text}
              disabled={confirmation_visible || is_submitting}
              onChange={(e) => set_text(e.target.value)}
              required
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>
                {text.length < MIN_COMMENT_LEN
                  ? `At least ${MIN_COMMENT_LEN - text.length} more characters required`
                  : "Minimum length reached"}
              </span>
              <span>
                {text.length}/4096
              </span>
            </div>

            <button
              type="submit"
              className={
                "mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg transition-colors duration-150 shadow disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              }
              disabled={
                !is_valid ||
                confirmation_visible ||
                is_submitting
              }
            >
              {is_submitting && (
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
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
                    d="M4 12a8 8 0 018-8v8z"
                  ></path>
                </svg>
              )}
              Submit Review
            </button>

            <div className="text-xs text-gray-500 pt-2">
              By submitting your feedback, you agree that your review may be visible to other users.
              <br />
              <span className="block text-gray-400 mt-2">
                You can edit or update your review for 48 hours after submission from your Trips page.
              </span>
            </div>
          </form>
        )}
      </div>
    </>
  );
};

export default UV_LeaveReview;