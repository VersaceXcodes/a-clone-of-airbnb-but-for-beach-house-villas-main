import React, { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/main";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
// Import Zod schemas/types for type safety
import { userSchema } from "@schema"; // Assumes "@schema" path works; otherwise inline types

import { Link, useNavigate } from "react-router-dom";

/** Types */
type User = z.infer<typeof userSchema>;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// ErrorBoundary fallback (will only wrap main form, not nav/footer)
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="w-full max-w-lg mx-auto bg-red-50 border border-red-200 rounded px-6 py-4 text-red-600 my-8">
    <h2 className="font-bold text-lg mb-2">Something went wrong with your profile</h2>
    <div className="mb-1">{error.message}</div>
    <Link to="/host/dashboard" className="text-blue-700 hover:underline">Go to Host Dashboard</Link>
  </div>
);

// Class-based error boundary to handle errors caused during render
class HostProfileEditErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    // Log error if wanted
  }
  render() {
    if (this.state.hasError && this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

const UV_HostProfileEdit: React.FC = () => {
  // Global session & state (observe only what is necessary)
  const token = useAppStore(s => s.user_session.token);
  const global_display_name = useAppStore(s => s.user_session.display_name);
  const global_profile_photo_url = useAppStore(s => s.user_session.profile_photo_url);
  const global_superhost_status = useAppStore(s => s.user_session.superhost_status);
  const set_user_session = useAppStore(s => s.set_user_session);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state for dirty tracking
  const [display_name, setDisplayName] = useState<string>("");
  const [profile_photo_url, setProfilePhotoUrl] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [contact_email, setContactEmail] = useState<string>("");
  const [is_superhost, setIsSuperhost] = useState<boolean>(false);

  const [formLoaded, setFormLoaded] = useState(false); // for initial data ready
  const [editError, setEditError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // === 1. Fetch current profile (from /account/me) ===
  const {
    data: profileData,
    error: profileError,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useQuery<User, Error>({
    queryKey: ["host-profile-me"],
    enabled: !!token,
    queryFn: async () => {
      const res = await axios.get<User>(`${API_BASE_URL}/account/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const parsed = userSchema.safeParse(res.data);
      if (parsed.success) return parsed.data;
      throw new Error("Failed to validate profile data.");
    },
    staleTime: 1000 * 60,
    retry: 1,
  });

  // === 2. Set local state on fetch success (but ignore on re-render) ===
  useEffect(() => {
    if (profileData && !formLoaded) {
      setDisplayName(profileData.display_name || "");
      setProfilePhotoUrl(profileData.profile_photo_url || "");
      setBio(profileData.bio || "");
      setContactEmail(profileData.contact_email || "");
      setIsSuperhost(profileData.is_superhost);
      setFormLoaded(true);
      setEditError(null);
    }
  }, [profileData, formLoaded]);

  // === 3. Save/Update mutation ===
  const {
    mutate: saveProfile,
    isPending: isSaving,
  } = useMutation<User, Error, Partial<User>>({
    mutationFn: async (input) => {
      // Only send changed fields
      const update: Record<string, string | null> = {};
      // Only fields from UserProfileUpdate
      if (input.display_name !== undefined) update.display_name = input.display_name;
      if (input.profile_photo_url !== undefined) update.profile_photo_url = input.profile_photo_url;
      if (input.bio !== undefined) update.bio = input.bio;
      if (input.contact_email !== undefined) update.contact_email = input.contact_email;
      const res = await axios.patch<User>(
        `${API_BASE_URL}/account/me`,
        update,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const parsed = userSchema.safeParse(res.data);
      if (parsed.success) return parsed.data;
      throw new Error("Failed to validate updated user");
    },
    onSuccess: (updated) => {
      setEditError(null);
      setShowSuccess(true);
      // Also, update local/global state session (per requirements)
      setDisplayName(updated.display_name || "");
      setProfilePhotoUrl(updated.profile_photo_url || "");
      setBio(updated.bio || "");
      setContactEmail(updated.contact_email || "");
      setIsSuperhost(updated.is_superhost);
      set_user_session({
        display_name: updated.display_name || "",
        profile_photo_url: updated.profile_photo_url || "",
        superhost_status: updated.is_superhost
      });
      // Invalidate cached profile for future
      queryClient.invalidateQueries({ queryKey: ["host-profile-me"] });
      // Success alert auto-hides
      setTimeout(() => setShowSuccess(false), 2000);
    },
    onError: (error: Error) => {
      setEditError(error.message || "Failed to update profile");
    },
  });

  // === 4. Dirty tracking: originalData for cancel/reset and submit disabling ===
  const initialData = profileData || {
    display_name: "",
    profile_photo_url: "",
    bio: "",
    contact_email: "",
    is_superhost: false,
  };

  const isDirty =
    formLoaded &&
    (
      display_name !== (initialData.display_name || "") ||
      profile_photo_url !== (initialData.profile_photo_url || "") ||
      bio !== (initialData.bio || "") ||
      contact_email !== (initialData.contact_email || "")
    );

  // === 5. Field Validators (minimal) ===
  const canSave =
    formLoaded &&
    display_name.trim().length > 0 &&
    contact_email.trim().length > 0 &&
    !isSaving &&
    isDirty;

  // === 6. Handle Cancel (reset fields) ===
  const handleCancel = useCallback(() => {
    setDisplayName(initialData.display_name || "");
    setProfilePhotoUrl(initialData.profile_photo_url || "");
    setBio(initialData.bio || "");
    setContactEmail(initialData.contact_email || "");
    setEditError(null);
  }, [
    initialData.display_name,
    initialData.profile_photo_url,
    initialData.bio,
    initialData.contact_email
  ]);

  // === 7. Submit handler ===
  const handleSave = (ev: React.FormEvent) => {
    ev.preventDefault();
    setEditError(null);
    if (display_name.trim().length === 0 || contact_email.trim().length === 0) {
      setEditError("Display name and contact email are required.");
      return;
    }
    // Only send fields which were changed
    const update: Partial<User> = {};
    if (display_name !== (initialData.display_name || "")) update.display_name = display_name.trim();
    if (profile_photo_url !== (initialData.profile_photo_url || "")) update.profile_photo_url = profile_photo_url.trim();
    if (bio !== (initialData.bio || "")) update.bio = bio.trim();
    if (contact_email !== (initialData.contact_email || "")) update.contact_email = contact_email.trim();

    saveProfile(update);
  };

  // --- Main render block ---
  const renderBody = (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] py-10 bg-gray-50">
      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-lg shadow px-8 py-8 relative">
        <h1 className="text-2xl font-extrabold mb-2 text-gray-900 flex items-center gap-2">
          Edit Host Profile
          {is_superhost && (
            <span
              title="Superhost: Consistently rated 4.7+, completed 10+ stays in the past year, maintains high response rate and 0 cancellations."
              className="bg-yellow-300 text-gray-800 rounded px-2 py-0.5 ml-2 text-xs font-semibold flex items-center whitespace-nowrap"
              data-testid="superhost-badge"
            >
              <svg className="w-4 h-4 mr-1 text-yellow-600 inline-block" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z"/></svg>
              Superhost
              <span className="ml-1 text-gray-600 cursor-help" title="What is Superhost?">&#9432;</span>
            </span>
          )}
        </h1>
        <div className="text-gray-600 mb-6">Keep your info up to date so guests trust your brand as a beach villa host.</div>

        {isProfileLoading && (
          <div className="flex justify-center items-center my-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
            <span className="ml-2 text-gray-400">Loading profile...</span>
          </div>
        )}

        {profileError && (
          <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-red-700 mb-4">
            {profileError.message}
          </div>
        )}

        {editError && (
          <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-red-700 mb-4">
            {editError}
          </div>
        )}

        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-green-700 mb-4">
            Profile saved successfully!
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSave} autoComplete="off">
          {/* Profile Photo preview and url input */}
          <div>
            <label className="block font-semibold text-gray-700 mb-2">Profile Photo</label>
            <div className="flex items-center gap-4">
              <img
                src={profile_photo_url || "https://picsum.photos/seed/profilehost/100"}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border border-gray-200"
                referrerPolicy="no-referrer"
              />
              <input
                type="url"
                className="block w-full border border-gray-300 rounded px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
                value={profile_photo_url}
                onChange={e => setProfilePhotoUrl(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Photo image URL..."
                disabled={isSaving}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Paste a photo URL (public JPG/PNG). Change will appear after save.
            </div>
          </div>
          {/* Display Name */}
          <div>
            <label className="block font-semibold text-gray-700 mb-2">Display Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="block w-full border border-gray-300 rounded px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
              value={display_name}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={255}
              required
              autoComplete="off"
              disabled={isSaving}
            />
          </div>
          {/* Contact Email */}
          <div>
            <label className="block font-semibold text-gray-700 mb-2">Contact Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              className="block w-full border border-gray-300 rounded px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
              value={contact_email}
              onChange={e => setContactEmail(e.target.value)}
              maxLength={255}
              required
              autoComplete="off"
              disabled={isSaving}
            />
          </div>
          {/* Bio */}
          <div>
            <label className="block font-semibold text-gray-700 mb-2">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="block w-full border border-gray-300 rounded px-3 py-2 focus:border-primary-500 focus:ring-primary-500"
              rows={3}
              maxLength={4096}
              placeholder="Tell guests about yourself and your hosting style"
              disabled={isSaving}
            />
          </div>
          {/* Superhost badge */}
          <div className="block mb-2">
            <div className="flex items-center gap-2">
              <label className="block font-semibold text-gray-700 mb-0">Superhost status:</label>
              <span
                className={`inline-block text-xs font-bold rounded px-2 py-0.5 ${
                  is_superhost
                    ? "bg-yellow-200 text-yellow-900"
                    : "bg-gray-100 text-gray-500"
                }`}
                title={is_superhost
                  ? "You're a Superhost! Guests see this badge on your listings."
                  : "Requirements: 10+ stays, avg 4.7+ rating, high response, no cancellations."}
              >
                {is_superhost ? "Yes" : "No"}
              </span>
              <span title="About Superhost status" className="ml-1 cursor-pointer text-gray-400">&#8505;</span>
            </div>
          </div>

          <div className="flex gap-2 mt-8 items-center">
            <button
              type="submit"
              className={`bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-2 rounded transition
                ${!canSave ? "opacity-60 cursor-not-allowed" : ""}`}
              disabled={!canSave}
              data-testid="save-btn"
            >
              {isSaving ? (
                <span className="inline-flex items-center"><svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving...</span>
              ) : (
                "Save"
              )}
            </button>
            <button
              type="button"
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-6 py-2 rounded transition"
              onClick={handleCancel}
              disabled={isSaving || !isDirty}
              data-testid="cancel-btn"
            >
              Cancel
            </button>
            <Link
              to="/host/dashboard"
              className="ml-auto text-primary-700 hover:underline text-sm"
            >
              &larr; Back to Host Dashboard
            </Link>
          </div>
        </form>
      </div>
    </div>
  );

  return <HostProfileEditErrorBoundary>{renderBody}</HostProfileEditErrorBoundary>;
};

export default UV_HostProfileEdit;