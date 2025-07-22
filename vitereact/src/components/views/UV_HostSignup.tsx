import React, { useState } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { useAppStore } from "@/store/main";

// Minimal TOS url for hosts - will link to /legal/host-terms (as per sitemap)
const HOST_TOS_URL = "/legal/host-terms";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const UV_HostSignup: React.FC = () => {
  // Form state
  const [email, set_email] = useState<string>("");
  const [password, set_password] = useState<string>("");
  const [display_name, set_display_name] = useState<string>("");
  const [profile_photo_url, set_profile_photo_url] = useState<string>("");
  const [bio, set_bio] = useState<string>("");
  const [contact_email, set_contact_email] = useState<string>("");
  const [agree_to_host_tos, set_agree_to_host_tos] = useState<boolean>(false);
  const [error, set_error] = useState<string | null>(null);
  const [loading, set_loading] = useState<boolean>(false);
  const [imgPreviewError, setImgPreviewError] = useState(false); // For accessibility/image fallback

  // Set user_session in zustand
  const set_user_session = useAppStore((state) => state.set_user_session);

  const navigate = useNavigate();

  // ---- Mutation for SIGNUP ----
  // Shape defined per OpenAPI: POST /auth/signup, body: { email, password, display_name, is_host }
  const hostSignupMutation = useMutation({
    mutationFn: async (variables: {
      email: string;
      password: string;
      display_name: string;
      is_host: boolean;
    }) => {
      // Only send fields legitimately handled by backend!
      const res = await axios.post(
        `${API_BASE_URL}/auth/signup`,
        {
          email: variables.email.trim(),
          password: variables.password,
          display_name: variables.display_name,
          is_host: true, // always host
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      set_user_session({
        user_id: typeof data.user_id === 'number' ? data.user_id : null,
        is_authenticated: true,
        is_host: !!data.is_host,
        token: data.token || '',
        display_name: data.display_name || '',
        profile_photo_url: typeof data.profile_photo_url === 'string' && data.profile_photo_url
          ? data.profile_photo_url
          : '',
        superhost_status: typeof data.superhost_status === 'boolean' ? data.superhost_status : false,
        unread_message_count: 0,
        last_active_at: new Date().toISOString(), // Never null, set at login
      });
      set_loading(false);
      // Go to host onboarding wizard
      navigate("/host/onboarding");
    },
    onError: (err: any) => {
      set_loading(false);
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        set_error(err.response.data.error);
      } else if (err instanceof Error) {
        set_error(err.message);
      } else {
        set_error("Could not complete signup. Please try again.");
      }
    },
  });

  // ---- Form Submit Handler ----
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    set_error(null);

    // -------- Client-side validation --------
    if (!email.trim()) {
      set_error("Email is required.");
      return;
    }
    // Basic email regex for UX (will be rechecked on backend)
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())) {
      set_error("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 8) {
      set_error("Password must be at least 8 characters.");
      return;
    }
    if (!display_name.trim()) {
      set_error("Display name is required.");
      return;
    }
    if (!agree_to_host_tos) {
      set_error(
        "You must agree to the BeachStay Host Terms of Service to continue."
      );
      return;
    }
    set_loading(true);

    // The backend will ignore profile_photo_url, bio, contact_email on signup
    hostSignupMutation.mutate({
      email: email.trim(),
      password,
      display_name: display_name.trim(),
      is_host: true,
    });
  };

  // -------- Error boundary/local error fallback --------
  let catastrophic_error = false;
  try {
    // bare try block, nothing to do before render
  } catch (e) {
    catastrophic_error = true;
  }

  // ----- Form Starts -----
  return (
    <>
      {/* Outermost container, centered */}
      <div className="flex w-full min-h-[calc(100vh-8rem)] items-center justify-center bg-gray-50 py-10 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8 space-y-7 border border-gray-100">
          <h1 className="text-2xl font-bold text-center text-gray-700">
            Become a BeachStay Host
          </h1>
          <p className="text-center text-gray-500 text-sm mb-4">
            Create your host account to list your villa rentals and start earning. Already have an account?{" "}
            <Link
              className="text-blue-600 underline hover:text-blue-800"
              to="/guest/login"
            >
              Log in
            </Link>
            . Or want to sign up as a guest?{" "}
            <Link
              className="text-blue-600 underline hover:text-blue-800"
              to="/guest/signup"
            >
              Guest Signup
            </Link>
          </p>
          {/* Error message */}
          {catastrophic_error ? (
            <div className="bg-red-100 text-red-700 rounded px-4 py-3 text-center mb-4">
              Something went wrong. Please reload.
            </div>
          ) : null}
          {error ? (
            <div className="bg-red-100 text-red-700 rounded px-4 py-3 text-center mb-4">
              {error}
            </div>
          ) : null}

          {/* Host Signup Form */}
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block font-medium text-sm text-gray-700 mb-1"
              >
                Email<span className="text-red-500 ml-1">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => set_email(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={loading}
                required
              />
            </div>
            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block font-medium text-sm text-gray-700 mb-1"
              >
                Password<span className="text-red-500 ml-1">*</span>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => set_password(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={loading}
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Minimum 8 characters.
              </p>
            </div>
            {/* Display Name */}
            <div>
              <label
                htmlFor="display_name"
                className="block font-medium text-sm text-gray-700 mb-1"
              >
                Host Display Name<span className="text-red-500 ml-1">*</span>
              </label>
              <input
                id="display_name"
                type="text"
                value={display_name}
                onChange={(e) => set_display_name(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={loading}
                required
              />
            </div>
            {/* Optional: Profile Photo URL preview and entry */}
            <div>
              <label
                htmlFor="profile_photo_url"
                className="block font-medium text-sm text-gray-700 mb-1"
              >
                Profile Photo URL <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                id="profile_photo_url"
                type="url"
                value={profile_photo_url}
                onChange={(e) => {
                  set_profile_photo_url(e.target.value);
                  setImgPreviewError(false);
                }}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={loading}
                placeholder="https://example.com/photo.jpg"
                aria-describedby="profile_photo_preview"
              />
              {/* Preview of entered or default */}
              <div className="flex items-center mt-2 space-x-2">
                <img
                  src={imgPreviewError || !profile_photo_url
                    ? 'https://picsum.photos/seed/beachhostsignup/48'
                    : profile_photo_url}
                  alt="Profile preview"
                  className="rounded-full border border-gray-200 w-12 h-12 object-cover"
                  onError={() => !imgPreviewError && setImgPreviewError(true)}
                  id="profile_photo_preview"
                />
                <span className="text-gray-400 text-xs">
                  Preview
                </span>
              </div>
            </div>
            {/* Optional: Host Bio */}
            <div>
              <label
                htmlFor="bio"
                className="block font-medium text-sm text-gray-700 mb-1"
              >
                Your Bio <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => set_bio(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 min-h-[64px] focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={loading}
                maxLength={2048}
                placeholder="Tell travelers about yourself!"
              />
            </div>
            {/* Optional: Contact Email (default is signup email) */}
            <div>
              <label
                htmlFor="contact_email"
                className="block font-medium text-sm text-gray-700 mb-1"
              >
                Contact Email <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                id="contact_email"
                type="email"
                value={contact_email}
                onChange={(e) => set_contact_email(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100"
                disabled={loading}
                placeholder="Notification email for your host account"
              />
              <p className="text-xs text-gray-400">
                Used for reservation notifications (leave blank to use above email).
              </p>
            </div>
            {/* Host TOS agreement (required) */}
            <div className="flex items-start space-x-2">
              <input
                id="agree_to_host_tos"
                type="checkbox"
                name="agree_to_host_tos"
                checked={agree_to_host_tos}
                onChange={(e) => set_agree_to_host_tos(e.target.checked)}
                required
                disabled={loading}
                className="mt-1 accent-blue-600"
              />
              <label htmlFor="agree_to_host_tos" className="text-sm text-gray-700">
                I agree to the{" "}
                <Link
                  to={HOST_TOS_URL}
                  className="text-blue-600 underline hover:text-blue-800"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  BeachStay Host Terms of Service
                </Link>
                .
              </label>
            </div>
            {/* Submit Button */}
            <div>
              <button
                type="submit"
                className={`w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition disabled:bg-blue-300 disabled:cursor-not-allowed`}
                disabled={
                  loading ||
                  !email ||
                  !password ||
                  !display_name ||
                  !agree_to_host_tos
                }
              >
                {loading ? (
                  <span className="animate-spin inline-block mr-2 align-middle">
                    <svg
                      className="w-5 h-5 text-white inline"
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
                  </span>
                ) : null}
                {loading ? "Creating Host Account..." : "Sign Up as Host"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default UV_HostSignup;