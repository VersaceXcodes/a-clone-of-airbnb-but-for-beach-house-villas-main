import React, { useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios, { AxiosError } from "axios";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useAppStore } from "@/store/main";

const emailSchema = z
	.string()
	.email("Please enter a valid email")
	.max(255, "Email too long");
const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.max(255, "Password too long");
const displayNameSchema = z
	.string()
	.min(1, "Display name is required")
	.max(255, "Display name is too long");

interface SignupRequest {
	email: string;
	password: string;
	display_name: string;
}

interface SignupResponse {
	token: string;
	user_id: string;
	is_host: boolean;
	display_name: string;
	profile_photo_url: string;
	superhost_status: boolean;
}

interface ErrorResponse {
	error: string;
}

const UV_GuestSignup: React.FC = () => {
	const [email, set_email] = useState<string>("");
	const [password, set_password] = useState<string>("");
	const [display_name, set_display_name] = useState<string>("");
	const [profile_photo_url, set_profile_photo_url] = useState<string | null>(
		null,
	); // for preview only
	const [agree_terms, set_agree_terms] = useState<boolean>(false);
	const [error_message, set_error_message] = useState<string | null>(null);
	const [is_submitting, set_is_submitting] = useState<boolean>(false);
	const [show_password, set_show_password] = useState<boolean>(false);
	const set_user_session = useAppStore((state) => state.set_user_session);
	const navigate = useNavigate();
	const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

	const validateFields = () => {
		const fieldErrors: {
			email?: string;
			password?: string;
			display_name?: string;
			agree_terms?: string;
		} = {};
		try {
			emailSchema.parse(email);
		} catch (e) {
			if (e instanceof z.ZodError) fieldErrors.email = e.issues[0].message;
		}
		try {
			passwordSchema.parse(password);
		} catch (e) {
			if (e instanceof z.ZodError) fieldErrors.password = e.issues[0].message;
		}
		try {
			displayNameSchema.parse(display_name);
		} catch (e) {
			if (e instanceof z.ZodError) fieldErrors.display_name = e.issues[0].message;
		}
		if (!agree_terms) {
			fieldErrors.agree_terms = "You must agree to the terms and privacy policy";
		}
		return fieldErrors;
	};

	const validation = useMemo(validateFields, [
		email,
		password,
		display_name,
		agree_terms,
	]);

	const mutation = useMutation<
		SignupResponse,
		AxiosError<ErrorResponse>,
		SignupRequest
	>({
		mutationFn: async (body) => {
			const url = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
			const res = await axios.post<SignupResponse>(`${url}/auth/signup`, body, {
				headers: { "Content-Type": "application/json" },
				timeout: 10000,
			});
			return res.data;
		},
		onSuccess: (data) => {
			// Map backend fields to Zustand structure and store immediately
			set_user_session({
				user_id: data.user_id,
				is_authenticated: true,
				is_host: data.is_host,
				token: data.token,
				display_name: data.display_name,
				profile_photo_url: data.profile_photo_url,
				superhost_status: data.superhost_status,
				unread_message_count: 0,
				last_active_at: null,
				email: email.trim(),
			});
			set_is_submitting(false);
			// Redirect after setting session
			navigate("/guest/dashboard");
		},
		onError: (error) => {
			set_is_submitting(false);
			console.error("Signup error:", error);

			if (error.code === "ECONNABORTED") {
				set_error_message(
					"Request timed out. Please check your connection and try again.",
				);
			} else if (error.response?.status === 502) {
				set_error_message(
					"Server is temporarily unavailable. Please try again in a moment.",
				);
			} else if (
				error.response?.status === 0 ||
				error.message === "Network Error"
			) {
				set_error_message("Network error. Please check your internet connection.");
			} else if (error.response?.data?.error) {
				set_error_message(error.response.data.error);
			} else {
				set_error_message("Could not sign up. Please try again.");
			}
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		set_error_message(null);

		if (Object.keys(validation).length > 0) {
			set_error_message(
				validation.email ||
					validation.password ||
					validation.display_name ||
					validation.agree_terms ||
					null,
			);
			return;
		}

		set_is_submitting(true);
		mutation.mutate({
			email: email.trim(),
			password,
			display_name: display_name.trim(),
		});
	};

	const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function (evt) {
				set_profile_photo_url(evt.target?.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const handleRemovePhoto = () => {
		set_profile_photo_url(null);
		if (profilePhotoInputRef.current) {
			profilePhotoInputRef.current.value = "";
		}
	};

	const handleShowPhotoUpload = () => {
		if (profilePhotoInputRef.current) {
			profilePhotoInputRef.current.click();
		}
	};

	const handleTogglePassword = () => set_show_password((v) => !v);

	const isDisabled =
		is_submitting ||
		!email ||
		!password ||
		!display_name ||
		!agree_terms ||
		!!validation.email ||
		!!validation.password ||
		!!validation.display_name ||
		!!validation.agree_terms;

	let content;
	try {
		content = (
			<div className="flex flex-col items-center justify-center w-full min-h-[70vh] py-10 bg-gray-50">
				<form
					className="w-full max-w-md bg-white rounded-lg shadow-lg p-8"
					onSubmit={handleSubmit}
					noValidate
				>
					<h2 className="text-2xl md:text-3xl font-bold text-center mb-6">
						Create your BeachStay account
					</h2>

					{/* Profile photo preview - only for client preview */}
					<div className="flex flex-col items-center mb-6">
						<div className="relative w-24 h-24 rounded-full overflow-hidden border border-gray-200 shadow-md mb-2 bg-white">
							{profile_photo_url ? (
								<img
									src={profile_photo_url}
									alt="Profile preview"
									className="w-full h-full object-cover"
								/>
							) : (
								<img
									src="https://picsum.photos/seed/profile_preview/96"
									alt="Default profile"
									className="w-full h-full object-cover opacity-50"
								/>
							)}
							{profile_photo_url && (
								<button
									type="button"
									className="absolute top-1 right-1 bg-white/60 rounded-full p-1 shadow text-xs"
									aria-label="Remove photo"
									onClick={handleRemovePhoto}
								>
									<svg
										className="w-5 h-5 text-red-500"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							)}
						</div>
						<input
							ref={profilePhotoInputRef}
							id="profile_photo"
							type="file"
							accept="image/*"
							className="hidden"
							onChange={handlePhotoChange}
							disabled={is_submitting}
							tabIndex={-1}
							aria-label="Choose profile photo"
						/>
						<button
							type="button"
							className="mt-1 px-4 py-2 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition"
							disabled={is_submitting}
							onClick={handleShowPhotoUpload}
							aria-label={profile_photo_url ? "Change Photo" : "Add Photo"}
						>
							{profile_photo_url ? "Change Photo" : "Add Photo"}
						</button>
						<span className="text-xs text-gray-400 mt-1">
							(Optional, not shared until booking)
						</span>
					</div>

					{/* Display name */}
					<div className="mb-4">
						<label
							htmlFor="display_name"
							className="block text-sm font-semibold mb-1"
						>
							Display name
						</label>
						<input
							id="display_name"
							type="text"
							className={`w-full px-4 py-2 border rounded focus:ring-indigo-500 focus:border-blue-400 transition outline-none ${validation.display_name ? "border-red-500" : "border-gray-300"}`}
							value={display_name}
							onChange={(e) => set_display_name(e.target.value)}
							autoComplete="name"
							disabled={is_submitting}
							required
							maxLength={255}
							placeholder="Your name"
							spellCheck={false}
							aria-invalid={!!validation.display_name}
							aria-describedby={
								validation.display_name ? "display_name_error" : undefined
							}
						/>
						{validation.display_name && (
							<span className="text-xs text-red-500" id="display_name_error">
								{validation.display_name}
							</span>
						)}
					</div>
					{/* Email */}
					<div className="mb-4">
						<label htmlFor="email" className="block text-sm font-semibold mb-1">
							Email
						</label>
						<input
							id="email"
							type="email"
							className={`w-full px-4 py-2 border rounded focus:ring-indigo-500 focus:border-blue-400 transition outline-none ${validation.email ? "border-red-500" : "border-gray-300"}`}
							value={email}
							onChange={(e) => set_email(e.target.value)}
							autoComplete="email"
							disabled={is_submitting}
							required
							maxLength={255}
							placeholder="you@email.com"
							spellCheck={false}
							aria-invalid={!!validation.email}
							aria-describedby={validation.email ? "email_error" : undefined}
						/>
						{validation.email && (
							<span className="text-xs text-red-500" id="email_error">
								{validation.email}
							</span>
						)}
					</div>
					{/* Password */}
					<div className="mb-4">
						<label htmlFor="password" className="block text-sm font-semibold mb-1">
							Password
						</label>
						<div className="relative">
							<input
								id="password"
								type={show_password ? "text" : "password"}
								className={`w-full px-4 py-2 border rounded focus:ring-indigo-500 focus:border-blue-400 transition outline-none pr-10 ${validation.password ? "border-red-500" : "border-gray-300"}`}
								value={password}
								onChange={(e) => set_password(e.target.value)}
								autoComplete="new-password"
								disabled={is_submitting}
								required
								minLength={8}
								maxLength={255}
								placeholder="Password (min 8 characters)"
								spellCheck={false}
								aria-invalid={!!validation.password}
								aria-describedby={validation.password ? "password_error" : undefined}
							/>
							<button
								type="button"
								className="absolute top-2 right-2 text-gray-400 hover:text-blue-600"
								aria-label={show_password ? "Hide password" : "Show password"}
								onClick={handleTogglePassword}
								tabIndex={-1}
								disabled={is_submitting}
							>
								{show_password ? (
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4.477-9-7s4-7 9-7c1.262 0 2.466.247 3.572.693M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
									</svg>
								) : (
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M3 3l18 18M9.88 9.88a3 3 0 104.24 4.24m2.06-2.06c.912-.912 1.832-2.181 1.83-4.06C17 7 13 3 12 3s-5 4-5 7c0 2.274.772 3.572 1.47 4.27m.53.53c.878.878 2.153 1.853 4.06 1.83"
										/>
									</svg>
								)}
							</button>
						</div>
						{validation.password && (
							<span className="text-xs text-red-500" id="password_error">
								{validation.password}
							</span>
						)}
					</div>
					{/* Terms/privacy checkbox */}
					<div className="mb-4">
						<label className="inline-flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								className="rounded border-gray-300"
								checked={agree_terms}
								onChange={(e) => set_agree_terms(e.target.checked)}
								disabled={is_submitting}
								required
								aria-invalid={!!validation.agree_terms}
								aria-describedby={validation.agree_terms ? "terms_error" : undefined}
							/>
							<span>
								I agree to the{" "}
								<Link
									to="/legal/terms"
									className="text-blue-600 hover:underline"
									target="_blank"
									rel="noopener noreferrer"
									tabIndex={-1}
								>
									Terms of Service
								</Link>{" "}
								and{" "}
								<Link
									to="/legal/privacy"
									className="text-blue-600 hover:underline"
									target="_blank"
									rel="noopener noreferrer"
									tabIndex={-1}
								>
									Privacy Policy
								</Link>
							</span>
						</label>
						{validation.agree_terms && (
							<div className="text-xs text-red-500 mt-1" id="terms_error">
								{validation.agree_terms}
							</div>
						)}
					</div>

					{/* Error message */}
					{error_message && (
						<div className="mb-4 text-center text-base text-red-700 bg-red-100 rounded p-2 border border-red-300">
							{error_message}
						</div>
					)}

					{/* Submit */}
					<button
						type="submit"
						className={`w-full py-3 mt-1 rounded font-semibold text-white bg-blue-600 hover:bg-blue-700 transition ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
						disabled={isDisabled}
					>
						{is_submitting ? (
							<span className="inline-flex items-center gap-2">
								<svg
									className="animate-spin h-5 w-5 text-white"
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
								Signing up...
							</span>
						) : (
							"Sign Up"
						)}
					</button>

					{/* Login and password reset links */}
					<div className="flex flex-col md:flex-row items-center justify-between mt-5 gap-2 text-sm">
						<span>
							Already have an account?{" "}
							<Link
								to="/guest/login"
								className="font-medium text-blue-700 hover:underline"
							>
								Login
							</Link>
						</span>
						<span>
							<Link
								to="/guest/password-reset"
								className="text-blue-600 hover:underline"
							>
								Forgot password?
							</Link>
						</span>
					</div>
				</form>
			</div>
		);
	} catch (err) {
		content = (
			<div className="flex items-center justify-center min-h-[60vh] text-lg text-red-700 p-6">
				Oops, something went wrong! Please reload the page.
			</div>
		);
	}

	return <>{content}</>;
};

export default UV_GuestSignup;
