import React, { useCallback, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/main";
import { z } from "zod";

// Types from Zod schemas (local redefs)
const villaSummarySchema = z.object({
	villa_id: z.union([z.number(), z.string()]), // always cast to string frontend-side
	title: z.string(),
	address_city: z.string(),
	main_photo_url: z.string(),
	price_per_night: z.number(),
	bedrooms: z.number(),
	beds: z.number(),
	bathrooms: z.number(),
	is_active: z.boolean(),
	is_instant_book: z.boolean(),
	avg_rating: z.number(),
	reviews_count: z.number(),
});

type VillaSummary = z.infer<typeof villaSummarySchema>;

// --- Data fetch functions ---

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
console.log("API_BASE configured as:", API_BASE);

// Configure axios defaults for better CORS handling
axios.defaults.withCredentials = false;
axios.defaults.headers.common["Accept"] = "application/json";

const fetchFeaturedVillas = async (): Promise<VillaSummary[]> => {
	try {
		console.log("Fetching featured villas from:", `${API_BASE}/villas/featured`);
		const { data } = await axios.get(`${API_BASE}/villas/featured`);
		console.log("Featured villas response:", data);
		return Array.isArray(data)
			? data.map((v: any) => ({
					...v,
					villa_id: String(v.villa_id),
					main_photo_url:
						v.main_photo_url ||
						`https://picsum.photos/seed/villa_${v.villa_id}/600/400`,
				}))
			: [];
	} catch (error) {
		console.error("Error fetching featured villas:", error);
		throw error;
	}
};

const fetchPopularDestinations = async (): Promise<string[]> => {
	try {
		console.log(
			"Fetching popular destinations from:",
			`${API_BASE}/villas/popular-locations`,
		);
		const { data } = await axios.get(`${API_BASE}/villas/popular-locations`);
		console.log("Popular destinations response:", data);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		console.error("Error fetching popular destinations:", error);
		throw error;
	}
};

// --- The View ---

const UV_Homepage: React.FC = () => {
	// --- Global state selects ---
	const user_session = useAppStore((state) => state.user_session);
	const search_state = useAppStore((state) => state.search_state);
	const set_search_state = useAppStore((state) => state.set_search_state);

	// Routing
	const navigate = useNavigate();

	// --- Local state for search bar ---
	const [location, set_location] = useState<string>(search_state.location || "");
	const [checkin_date, set_checkin_date] = useState<string | null>(
		search_state.checkin_date || null,
	);
	const [checkout_date, set_checkout_date] = useState<string | null>(
		search_state.checkout_date || null,
	);
	const [num_guests, set_num_guests] = useState<number>(
		search_state.num_guests || 1,
	);

	// --- Featured villas query ---
	const {
		data: featured_villas,
		isLoading: featured_loading,
		isError: featured_error,
		error: featured_error_info,
		refetch: refetchFeatured,
	} = useQuery<VillaSummary[], Error>({
		queryKey: ["featured_villas"],
		queryFn: fetchFeaturedVillas,
		staleTime: 60 * 1000,
	});

	// --- Popular destinations query ---
	const {
		data: popular_destinations,
		isLoading: destinations_loading,
		isError: destinations_error,
		error: destinations_error_info,
		refetch: refetchDestinations,
	} = useQuery<string[], Error>({
		queryKey: ["popular_destinations"],
		queryFn: fetchPopularDestinations,
		staleTime: 60 * 1000,
	});

	// --- Greeting (from user_session.display_name) ---
	const personalized_greeting =
		user_session.is_authenticated && user_session.display_name
			? `Welcome back, ${user_session.display_name.split(" ")[0] || user_session.display_name}!`
			: null;

	// --- Search Form Handling ---

	const onSubmitSearch = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			set_search_state({
				...search_state,
				location,
				checkin_date,
				checkout_date,
				num_guests,
				page: 1,
			});
			const params = new URLSearchParams();
			if (location) params.append("location", location);
			if (checkin_date) params.append("checkin_date", checkin_date);
			if (checkout_date) params.append("checkout_date", checkout_date);
			if (num_guests && num_guests > 0)
				params.append("num_guests", String(num_guests));
			navigate(`/search?${params.toString()}`);
		},
		[
			location,
			checkin_date,
			checkout_date,
			num_guests,
			set_search_state,
			navigate,
			search_state,
		],
	);

	// Utility: Format price (e.g., $123)
	const formatPrice = (price: number) =>
		typeof price === "number"
			? `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
			: "";

	// Utility: Card rating display
	const renderStars = (rating: number) => {
		if (typeof rating !== "number" || rating <= 0) return null;
		const fullStars = Math.round(rating * 2) / 2;
		return (
			<span className="flex items-center gap-0.5">
				<svg
					className="w-4 h-4 text-yellow-400"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path d="M10 15l-5.878 3.09L5.66 12.18.782 8.452l6.268-.91L10 1.5l2.95 6.042 6.268.91-4.878 3.727 1.538 5.91z" />
				</svg>
				<span className="text-xs font-semibold">{(fullStars || 0).toFixed(1)}</span>
			</span>
		);
	};

	// --- Keyboard UX: Focus on location input on mount if empty ---
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (!location && inputRef.current) {
			inputRef.current.focus();
		}
	}, [location]); // only runs on first mount usually

	// --- Above-the-fold CTA (List Your Villa) behaviour ---
	const listYourVillaHref = user_session.is_authenticated
		? "/host/onboarding"
		: "/guest/login?returnTo=/host/onboarding";

	// --- Error boundaries for villa/destinations sections ---
	// (react-error-boundary pattern inline for simplicity)
	const [villa_section_has_error] = useState(false);
	const [dest_section_has_error] = useState(false);

	// --- Render Single Block ---
	return (
		<>
			{/* Hero Section */}
			<div
				className="relative w-full bg-cover bg-center min-h-[350px] flex items-center justify-center"
				style={{
					backgroundImage: "url('https://picsum.photos/seed/beachhero/1600/700')",
				}}
			>
				<div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
				<div className="z-10 flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-16">
					{personalized_greeting ? (
						<h2 className="text-white text-3xl sm:text-4xl font-bold mb-6 drop-shadow-lg text-center">
							{personalized_greeting}
						</h2>
					) : (
						<h1 className="text-white text-4xl sm:text-6xl font-extrabold mb-4 drop-shadow-lg text-center">
							Find your perfect beach villa.
						</h1>
					)}
					<p className="mt-1 mb-7 text-white font-medium text-lg text-center drop-shadow">
						Sun-drenched escapes, ocean breezes, barefoot living.
					</p>
					{/* Search Bar */}
					<form
						className="w-full max-w-3xl bg-white/95 shadow-lg rounded-lg p-4 flex flex-col md:flex-row gap-2 md:gap-4 items-center"
						onSubmit={onSubmitSearch}
						aria-label="Search for beach villas"
					>
						<input
							type="text"
							name="location"
							ref={inputRef}
							autoComplete="off"
							placeholder="Where to? (city or beach)"
							className="flex-1 min-w-[120px] rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
							value={location}
							onChange={(e) => set_location(e.target.value)}
						/>
						<input
							type="date"
							name="checkin_date"
							className="w-[120px] rounded-lg border border-gray-300 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
							value={checkin_date || ""}
							onChange={(e) => set_checkin_date(e.target.value || null)}
							min={new Date().toISOString().slice(0, 10)}
							placeholder="Check-in"
						/>
						<input
							type="date"
							name="checkout_date"
							className="w-[120px] rounded-lg border border-gray-300 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
							value={checkout_date || ""}
							onChange={(e) => set_checkout_date(e.target.value || null)}
							min={checkin_date || new Date().toISOString().slice(0, 10)}
							placeholder="Check-out"
						/>
						<input
							type="number"
							name="num_guests"
							className="w-[90px] rounded-lg border border-gray-300 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
							min={1}
							value={num_guests}
							onChange={(e) =>
								set_num_guests(Math.max(1, parseInt(e.target.value) || 1))
							}
							placeholder="Guests"
						/>
						<button
							type="submit"
							className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
							aria-label="Search"
						>
							Search
						</button>
					</form>
					{/* Row: Primary CTAs after search */}
					<div className="mt-6 flex flex-wrap gap-4 justify-center items-center w-full">
						<Link
							to={listYourVillaHref}
							className="inline-block bg-gradient-to-r from-teal-500 to-blue-500 hover:from-blue-500 hover:to-teal-500 text-white font-semibold shadow-md px-6 py-3 rounded-3xl text-lg transition-all"
						>
							List Your Villa
						</Link>
						{!user_session.is_authenticated && (
							<>
								<Link
									to="/guest/login"
									className="text-white bg-black/50 hover:bg-black/70 font-semibold rounded-3xl px-5 py-2 transition"
								>
									Login
								</Link>
								<Link
									to="/guest/signup"
									className="text-white bg-black/40 hover:bg-black/70 font-semibold rounded-3xl px-5 py-2 transition"
								>
									Sign Up
								</Link>
							</>
						)}
					</div>
				</div>
			</div>

			{/* MAIN CONTENT CONTAINER */}
			<div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-12 flex flex-col gap-16">
				{/* Featured Villas Carousel */}
				<section>
					<div className="flex items-end justify-between mb-2">
						<h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
							Featured Villas
						</h2>
						<button
							className="text-blue-600 underline underline-offset-4 hover:text-blue-800 focus:outline-none disabled:opacity-70 text-sm"
							onClick={() => refetchFeatured()}
							disabled={featured_loading}
							aria-label="Refresh Featured Villas"
							type="button"
						>
							Refresh
						</button>
					</div>
					<div className="relative">
						{/* Loading State */}
						{featured_loading && (
							<div className="flex flex-nowrap gap-4 overflow-x-scroll pb-2">
								{Array.from({ length: 4 }).map((_, i) => (
									<div
										key={i}
										className="animate-pulse w-[300px] h-[320px] rounded-2xl bg-gray-200 flex-shrink-0"
									/>
								))}
							</div>
						)}
						{/* Error State */}
						{featured_error && (
							<div className="bg-red-100 py-3 px-5 rounded-lg my-2">
								<p className="text-red-700">
									Failed to load featured villas.{" "}
									<button
										className="underline text-blue-700"
										onClick={() => refetchFeatured()}
										type="button"
									>
										Retry
									</button>
								</p>
							</div>
						)}
						{/* Data or Empty State */}
						{!featured_loading && !featured_error && (
							<div
								className="flex flex-nowrap gap-4 overflow-x-auto pb-2 snap-x"
								style={{ WebkitOverflowScrolling: "touch" }}
							>
								{featured_villas && featured_villas.length > 0 ? (
									featured_villas.map((villa, idx) => (
										<Link
											key={villa.villa_id || idx}
											to={`/villa/${villa.villa_id}`}
											className="bg-white rounded-2xl shadow hover:shadow-lg transform hover:-translate-y-1 transition-all min-w-[275px] max-w-[315px] w-[285px] flex-shrink-0 flex flex-col snap-start"
										>
											<div className="relative rounded-t-2xl overflow-hidden h-[180px] bg-gray-100">
												<img
													src={villa.main_photo_url}
													alt={villa.title}
													className="object-cover w-full h-full transition-transform duration-200"
													loading="lazy"
												/>
												{villa.is_instant_book && (
													<span className="absolute top-2 right-2 bg-green-500/80 text-xs px-2 py-0.5 rounded text-white font-medium shadow">
														Instant Book
													</span>
												)}
											</div>
											<div className="flex-1 flex flex-col px-4 pt-3 pb-4">
												<div className="flex items-center justify-between mb-1">
													<div className="flex items-center gap-2">
														{villa.avg_rating > 0 && renderStars(Number(villa.avg_rating))}
														{villa.reviews_count > 0 && (
															<span className="ml-1 text-xs text-gray-600">
																({villa.reviews_count})
															</span>
														)}
													</div>
												</div>
												<h3 className="text-lg font-semibold truncate" title={villa.title}>
													{villa.title}
												</h3>
												<div className="flex flex-row items-center text-sm text-gray-500 gap-2 mt-0.5">
													<svg
														className="w-4 h-4 text-blue-400 inline"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path d="M10 18c-6-5.39-8-7.182-8-10A8 8 0 118 18h4zm0-8a2 2 0 110-4 2 2 0 010 4z" />
													</svg>
													<span>{villa.address_city}</span>
												</div>
												<div className="mt-3 flex items-center justify-between">
													<span className="font-bold text-blue-700 text-lg">
														{formatPrice(villa.price_per_night)}
														<span className="text-sm text-gray-400 ml-1">/night</span>
													</span>
													<span className="inline-block text-xs text-gray-500">
														{villa.bedrooms} bd · {villa.beds} beds · {villa.bathrooms} ba
													</span>
												</div>
											</div>
										</Link>
									))
								) : (
									<div className="text-sm text-gray-600 font-medium p-4">
										No featured villas available at the moment.
									</div>
								)}
							</div>
						)}
					</div>
				</section>

				{/* Popular Destinations */}
				<section className="w-full">
					<div className="flex items-end justify-between mb-2">
						<h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
							Popular Beach Destinations
						</h2>
						<button
							className="text-blue-600 underline underline-offset-4 hover:text-blue-800 focus:outline-none disabled:opacity-70 text-sm"
							onClick={() => refetchDestinations()}
							disabled={destinations_loading}
							type="button"
							aria-label="Refresh Destinations"
						>
							Refresh
						</button>
					</div>
					<div className="relative">
						{/* Loading */}
						{destinations_loading && (
							<div className="flex flex-wrap gap-5 py-2">
								{Array.from({ length: 7 }).map((_, i) => (
									<div
										key={i}
										className="animate-pulse w-[172px] h-[100px] rounded-xl bg-gray-200"
									/>
								))}
							</div>
						)}
						{/* Error */}
						{destinations_error && (
							<div className="bg-red-100 py-3 px-5 rounded-lg my-2">
								<p className="text-red-700">
									Failed to load destinations.{" "}
									<button
										className="underline text-blue-700"
										onClick={() => refetchDestinations()}
										type="button"
									>
										Retry
									</button>
								</p>
							</div>
						)}
						{/* Data or Empty */}
						{!destinations_loading && !destinations_error && (
							<div className="flex flex-wrap gap-5">
								{popular_destinations && popular_destinations.length > 0 ? (
									popular_destinations.map((city, idx) => (
										<Link
											key={city || idx}
											to={`/search?location=${encodeURIComponent(city)}`}
											className="group flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 border border-blue-200 rounded-xl shadow hover:shadow-lg h-[100px] w-[172px] transition-all hover:scale-[1.04] focus:ring-2 ring-blue-400"
											tabIndex={0}
											aria-label={`Browse villas in ${city}`}
										>
											<span className="text-base font-semibold text-blue-800 group-hover:text-teal-700">
												{city}
											</span>
											<span className="mt-1 text-xs text-blue-400 group-hover:text-teal-500">
												View villas →
											</span>
										</Link>
									))
								) : (
									<div className="text-sm text-gray-600 font-medium p-4">
										No popular destinations found.
									</div>
								)}
							</div>
						)}
					</div>
				</section>

				{/* Beach inspiration tagline */}
				<div className="mx-auto max-w-3xl text-center text-lg text-gray-600 py-3">
					<span>
						Discover your new favorite beach{" "}
						<span className="font-semibold text-blue-500">getaway</span> – from
						sun-kissed coasts to secret escapes, BeachStay Villas brings the ocean
						closer to you.
					</span>
				</div>
			</div>
		</>
	);
};

export default UV_Homepage;
