import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";
import { useAppStore } from "@/store/main";
import { Link, useNavigate } from "react-router-dom";
// Import zod types from shared schemas
import {
  userSchema,
  updateUserInputSchema,
} from "@schema";

// Types
// prettier-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// eslint-disable-next-line camelcase
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type User = z.infer<typeof userSchema>;
type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// GET /account/me (returns User)
async function fetchProfile(token: string): Promise<User> {
  const { data } = await axios.get<User>(`${API_BASE_URL}/account/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return userSchema.parse(data);
}

// PATCH /account/me (input: UpdateUserInput minus user_id field)
async function updateProfile(
  token: string,
  input: Partial<UpdateUserInput>
): Promise<User> {
  const patchData = { ...input };
  delete (patchData as any).user_id;
  const { data } = await axios.patch<User>(
    `${API_BASE_URL}/account/me`,
    patchData,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return userSchema.parse(data);
}

function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const UV_GuestProfileEdit: React.FC = () => {
  // Zustand: Get session & update method
  const user_session = useAppStore((s) => s.user_session);
  const set_user_session = useAppStore((s) => s.set_user_session);
  const is_authenticated = !!user_session?.token;

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State: Profile Editable Fields
  const [display_name, set_display_name] = useState<string>("");
  const [profile_photo_url, set_profile_photo_url] = useState<string>("");
  const [bio, set_bio] = useState<string>("");
  const [contact_email, set_contact_email] = useState<string>("");

  // Avatar (for file picker UI, use ref for file input)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [local_image, set_local_image] = useState<string | null>(null); // For live preview
  const [avatar_error, set_avatar_error] = useState<string | null>(null);

  // UI state
  const [editTouched, setEditTouched] = useState(false); // mark if fields have been edited
  const [formError, setFormError] = useState<string | null>(null);

  // Query: Fetch profile on mount
  const { data: userData, isLoading, isError, error, refetch } = useQuery<User, Error>({
    queryKey: ["account", "me"],
    queryFn: () => {
      if (!user_session?.token) throw new Error("Not authenticated");
      return fetchProfile(user_session.token ?? "");
    },
    enabled: is_authenticated,
    refetchOnWindowFocus: false,
  });

  // Effect: Sync form fields to fetched user data
  useEffect(() => {
    if (userData) {
      set_display_name(userData.display_name ?? "");
      set_profile_photo_url(userData.profile_photo_url ?? "");
      set_bio(userData.bio ?? "");
      set_contact_email(userData.contact_email ?? "");
      set_local_image(null); // Clear any temp avatar on fetch
      setFormError(null);
      setEditTouched(false);
    }
  }, [userData]);

  // Effect: Redirect if not authenticated
  useEffect(() => {
    if (!is_authenticated) {
      navigate("/guest/login");
    }
  }, [is_authenticated, navigate]);

  // Mutation: Save profile patch
  const mutation = useMutation<User, Error, Partial<UpdateUserInput>>({
    mutationFn: (input) => {
      if (!user_session?.token) throw new Error("Auth required");
      return updateProfile(user_session.token ?? "", input);
    },
    onSuccess: (newUser) => {
      set_user_session({
        ...user_session,
        display_name: newUser.display_name ?? "",
        profile_photo_url: newUser.profile_photo_url ?? "",
        contact_email: newUser.contact_email ?? "",
        bio: newUser.bio ?? ""
      });
      queryClient.invalidateQueries({ queryKey: ["account", "me"] });
      setEditTouched(false);
      setFormError(null);
      set_avatar_error(null);
    },
    onError: (e) => {
      setFormError(e.message || "Update failed");
    },
  });

  // Validation - displayName required, contact_email required!
  const displayNameTrimmed = display_name.trim();
  const isDisplayNameValid = displayNameTrimmed.length > 0 && displayNameTrimmed.length <= 255;
  const contactEmailTrimmed = contact_email.trim();
  const isContactEmailValid = 
    contactEmailTrimmed.length > 0 && 
    contactEmailTrimmed.length <= 255 && 
    isValidEmail(contactEmailTrimmed);
  const canSave = 
    isDisplayNameValid && 
    isContactEmailValid && 
    !mutation.isPending && 
    (editTouched || local_image);

  // Event Handlers
  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    set_avatar_error(null);

    if (!isDisplayNameValid) {
      setFormError("Display name is required.");
      return;
    }
    if (!isContactEmailValid) {
      setFormError("Please provide a valid email address.");
      return;
    }

    // If local_image is set, user chose a new local avatar
    let final_profile_photo_url: string | null = profile_photo_url || null;
    if (local_image) {
      final_profile_photo_url = local_image;
    }

    mutation.mutate({
      display_name: display_name.trim(),
      profile_photo_url: final_profile_photo_url ? final_profile_photo_url.trim() : null,
      bio: bio.trim() || null,
      contact_email: contact_email.trim() || null,
    });
  }

  function handleCancel() {
    if (userData) {
      set_display_name(userData.display_name ?? "");
      set_profile_photo_url(userData.profile_photo_url ?? "");
      set_bio(userData.bio ?? "");
      set_contact_email(userData.contact_email ?? "");
      setFormError(null);
      setEditTouched(false);
      set_local_image(null);
      set_avatar_error(null);
    }
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    set_avatar_error(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      set_avatar_error("Please select a valid image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      set_avatar_error("File must be less than 2MB.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      set_local_image(dataUrl);
      setEditTouched(true);
    } catch (e) {
      set_avatar_error("Could not preview image.");
    }
  }

  function handleAvatarChooseUrl() {
    const url = window.prompt("Paste an image URL to use as your profile picture:");
    if (!url) return;
    if (
      !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/.test(url.toLowerCase())
    ) {
      set_avatar_error("Please enter a direct link to an image.");
      return;
    }
    set_profile_photo_url(url.trim());
    set_local_image(null); // Invalidate any local preview
    setEditTouched(true);
    set_avatar_error(null);
  }

  let errorBoundary: React.ReactNode = null;
  if (isError || formError) {
    errorBoundary = (
      <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-2 rounded mb-4">
        {formError || error?.message || "An error occurred while loading profile info."}
      </div>
    );
  }

  if (isLoading || !is_authenticated) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="text-lg text-gray-500">Loading profile...</div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">Edit Your Profile</h1>
        <p className="mb-6 text-gray-500">Update your information below. All fields are required except bio.</p>
        {errorBoundary}
        <form
          className="w-full bg-white rounded-lg shadow p-6 border border-gray-100"
          onSubmit={handleSave}
          autoComplete="off"
        >
          {/* --- Avatar display and update --- */}
          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <img
                src={
                  local_image ||
                  profile_photo_url ||
                  `https://picsum.photos/seed/${user_session.user_id || "default"}/128`
                }
                alt="Profile avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
              />
              {/* Overlay avatar upload button */}
              <button
                type="button"
                className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-1 hover:bg-blue-700 transition"
                aria-label="Upload new avatar"
                onClick={() => fileInputRef.current?.click()}
                tabIndex={0}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20v-6M12 4V2M4.93 4.93l-1.42-1.42M19.07 19.07l1.42 1.42M1 12h2m18 0h2m-4.93-7.07l1.42-1.42M4.93 19.07l-1.42 1.42"></path>
                  <circle cx="12" cy="12" r="5"></circle>
                </svg>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-200 text-sm font-medium hover:bg-gray-50"
                onClick={handleAvatarChooseUrl}
              >
                Use Image by URL
              </button>
              {local_image && (
                <button
                  type="button"
                  className="text-xs text-red-500 underline"
                  onClick={() => {
                    set_local_image(null);
                    set_avatar_error(null);
                    setEditTouched(true);
                  }}
                >
                  Remove Unsaved Photo
                </button>
              )}
              {avatar_error && <span className="text-red-500 text-xs">{avatar_error}</span>}
            </div>
          </div>

          {/* --- Display Name --- */}
          <div className="mb-4">
            <label htmlFor="display_name" className="block font-semibold mb-1">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="display_name"
              value={display_name}
              onChange={(e) => {
                set_display_name(e.target.value);
                setEditTouched(true);
              }}
              className={`w-full px-3 py-2 border rounded ${
                !isDisplayNameValid ? "border-red-400" : "border-gray-200"
              } focus:outline-none focus:ring-2 focus:ring-blue-200`}
              maxLength={255}
              required
              placeholder="Your name"
              autoComplete="name"
            />
            {!isDisplayNameValid && (
              <span className="text-xs text-red-500">
                Display name is required and must be under 255 characters.
              </span>
            )}
          </div>

          {/* --- Contact Email --- */}
          <div className="mb-4">
            <label htmlFor="contact_email" className="block font-semibold mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="contact_email"
              value={contact_email}
              onChange={(e) => {
                set_contact_email(e.target.value);
                setEditTouched(true);
              }}
              className={`w-full px-3 py-2 border rounded ${
                !isContactEmailValid ? "border-red-400" : "border-gray-200"
              } focus:outline-none focus:ring-2 focus:ring-blue-200`}
              maxLength={255}
              required
              placeholder="your@email.com"
              autoComplete="email"
            />
            {!isContactEmailValid && (
              <span className="text-xs text-red-500">
                Please provide a valid email address (required, under 255 characters).
              </span>
            )}
          </div>

          {/* --- Bio --- */}
          <div className="mb-4">
            <label htmlFor="bio" className="block font-semibold mb-1">
              Short Bio <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => {
                set_bio(e.target.value);
                setEditTouched(true);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded min-h-[64px] focus:outline-none focus:ring-2 focus:ring-blue-200"
              maxLength={4096}
              placeholder="Tell us about yourself"
            />
            {bio?.length > 4096 && (
              <span className="text-xs text-red-500">
                Bio must be shorter than 4096 characters.
              </span>
            )}
          </div>

          {/* --- Buttons --- */}
          <div className="flex items-center mt-6 gap-3">
            <button
              type="submit"
              disabled={!canSave}
              className={`bg-blue-600 text-white font-semibold px-5 py-2 rounded shadow transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {mutation.isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={mutation.isPending}
              className="bg-gray-100 text-gray-700 font-semibold px-5 py-2 rounded shadow hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <Link
              to="/guest/dashboard"
              className="ml-auto text-blue-700 font-medium underline hover:text-blue-900 text-sm"
            >
              Back to Dashboard
            </Link>
          </div>

          {/* --- Success feedback --- */}
          {mutation.isSuccess && !editTouched && (
            <div className="mt-3 text-green-600 text-sm flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                   strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Profile updated!
            </div>
          )}
        </form>
      </div>
    </>
  );
};

export default UV_GuestProfileEdit;