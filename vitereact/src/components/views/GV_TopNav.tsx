import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAppStore } from "@/store/main";
import { Transition } from "@headlessui/react";
import { format } from "date-fns";
import {
	HiOutlineMenu,
	HiOutlineX,
	HiOutlineBell,
	HiOutlineUserCircle,
	HiOutlineLogout,
	HiOutlineInbox,
	HiOutlineHeart,
	HiOutlineHome,
} from "react-icons/hi";

const getDefaultAvatar = (seed: string | number) =>
	`https://picsum.photos/seed/beachstay_user_${seed || "default"}/40`;

const GV_TopNav: React.FC = () => {
	const is_authenticated = useAppStore((s) => s.user_session.is_authenticated);
	const is_host = useAppStore((s) => s.user_session.is_host);
	const display_name = useAppStore((s) => s.user_session.display_name);
	const profile_photo_url = useAppStore((s) => s.user_session.profile_photo_url);
	const superhost_status = useAppStore((s) => s.user_session.superhost_status);
	const unread_message_count = useAppStore(
		(s) => s.user_session.unread_message_count,
	);
	const user_id = useAppStore((s) => s.user_session.user_id);
	const search_state = useAppStore((s) => s.search_state);
	const set_search_state = useAppStore((s) => s.set_search_state);
	const reset_search_state = useAppStore((s) => s.reset_search_state);
	const logout = useAppStore((s) => s.logout);
	const navigate = useNavigate();
	const location = useLocation();

	const [locationValue, setLocationValue] = useState(
		search_state.location || "",
	);
	const [checkinValue, setCheckinValue] = useState<string | null>(
		search_state.checkin_date || null,
	);
	const [checkoutValue, setCheckoutValue] = useState<string | null>(
		search_state.checkout_date || null,
	);
	const [numGuestsValue, setNumGuestsValue] = useState<number>(
		search_state.num_guests || 1,
	);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
	const profileButtonRef = useRef(null);
	const dropdownRef = useRef(null);

	useEffect(() => {
		setMobileMenuOpen(false);
		setProfileDropdownOpen(false);
		setLocationValue(search_state.location || "");
		setCheckinValue(search_state.checkin_date || null);
		setCheckoutValue(search_state.checkout_date || null);
		setNumGuestsValue(search_state.num_guests || 1);
	}, [
		location.pathname,
		search_state.location,
		search_state.checkin_date,
		search_state.checkout_date,
		search_state.num_guests,
	]);

	// Focus management for dropdown
	useEffect(() => {
		if (profileDropdownOpen && dropdownRef.current) {
			// Focus first menuitem
			const firstMenuitem = dropdownRef.current.querySelector('[role="menuitem"]');
			if (firstMenuitem) {
				firstMenuitem.focus();
			}
		}
	}, [profileDropdownOpen]);

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (
				profileDropdownOpen &&
				profileButtonRef.current &&
				!profileButtonRef.current.contains(e.target as Node) &&
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target)
			) {
				setProfileDropdownOpen(false);
			}
		}
		function handleKeydown(e: KeyboardEvent) {
			if (profileDropdownOpen && e.key === "Escape") {
				setProfileDropdownOpen(false);
				profileButtonRef.current && profileButtonRef.current.focus();
			}
			// Basic trap focus inside dropdown
			if (profileDropdownOpen && dropdownRef.current && e.key === "Tab") {
				const focusables = Array.from(
					dropdownRef.current.querySelectorAll('[role="menuitem"]'),
				);
				if (focusables.length === 0) return;
				const first = focusables[0];
				const last = focusables[focusables.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKeydown);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKeydown);
		};
	}, [profileDropdownOpen]);

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// PATCH: Spread current search_state (filters, sort, etc.) instead of clobbering it
		set_search_state({
			...search_state,
			location: locationValue,
			checkin_date: checkinValue || null,
			checkout_date: checkoutValue || null,
			num_guests: numGuestsValue,
			page: 1,
		});
		const params = new URLSearchParams();
		if (locationValue) params.set("location", locationValue);
		if (checkinValue) params.set("checkin_date", checkinValue);
		if (checkoutValue) params.set("checkout_date", checkoutValue);
		if (numGuestsValue > 0) params.set("num_guests", String(numGuestsValue));
		const { filters, sort } = search_state || {};
		if (filters) {
			if (filters.price_min !== null)
				params.set("price_min", String(filters.price_min));
			if (filters.price_max !== null)
				params.set("price_max", String(filters.price_max));
			if (filters.bedrooms !== null)
				params.set("bedrooms", String(filters.bedrooms));
			if (filters.beds !== null) params.set("beds", String(filters.beds));
			if (filters.bathrooms !== null)
				params.set("bathrooms", String(filters.bathrooms));
			if (Array.isArray(filters.amenities) && filters.amenities.length > 0)
				params.set("amenities", filters.amenities.join(","));
			if (filters.is_beachfront !== null)
				params.set("is_beachfront", String(filters.is_beachfront));
			if (filters.is_pet_friendly !== null)
				params.set("is_pet_friendly", String(filters.is_pet_friendly));
			if (filters.is_instant_book !== null)
				params.set("is_instant_book", String(filters.is_instant_book));
		}
		if (sort) params.set("sort", sort);
		navigate(`/search?${params.toString()}`);
	};

	const handleLogout = () => {
		logout();
		navigate("/");
	};

	const profileMenu = (
		<div
			className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg z-40 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
			role="menu"
			aria-orientation="vertical"
			aria-labelledby="user-menu"
			tabIndex={-1}
			ref={dropdownRef}
		>
			{is_authenticated ? (
				<>
					{is_host ? (
						<>
							<Link
								to="/host/dashboard"
								className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 font-medium"
								role="menuitem"
								tabIndex={0}
								onClick={() => setProfileDropdownOpen(false)}
							>
								Host Dashboard
							</Link>
							<Link
								to="/host/profile/edit"
								className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
								role="menuitem"
								tabIndex={0}
								onClick={() => setProfileDropdownOpen(false)}
							>
								Edit Profile
							</Link>
							<Link
								to="/messaging"
								className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
								role="menuitem"
								tabIndex={0}
								onClick={() => setProfileDropdownOpen(false)}
							>
								Inbox{" "}
								{unread_message_count > 0 && (
									<span className="ml-2 px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs">
										{unread_message_count}
									</span>
								)}
							</Link>
						</>
					) : (
						<>
							<Link
								to="/guest/dashboard"
								className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 font-medium"
								role="menuitem"
								tabIndex={0}
								onClick={() => setProfileDropdownOpen(false)}
							>
								Guest Dashboard
							</Link>
							<Link
								to="/guest/my-trips"
								className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
								role="menuitem"
								tabIndex={0}
								onClick={() => setProfileDropdownOpen(false)}
							>
								My Trips
							</Link>
							<Link
								to="/guest/wishlists"
								className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
								role="menuitem"
								tabIndex={0}
								onClick={() => setProfileDropdownOpen(false)}
							>
								Wishlists
							</Link>
							<Link
								to="/messaging"
								className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
								role="menuitem"
								tabIndex={0}
								onClick={() => setProfileDropdownOpen(false)}
							>
								Inbox{" "}
								{unread_message_count > 0 && (
									<span className="ml-2 px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs">
										{unread_message_count}
									</span>
								)}
							</Link>
							<Link
								to="/guest/profile/edit"
								className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
								role="menuitem"
								tabIndex={0}
								onClick={() => setProfileDropdownOpen(false)}
							>
								Edit Profile
							</Link>
						</>
					)}
					<button
						onClick={handleLogout}
						className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
						role="menuitem"
						tabIndex={0}
					>
						<span className="inline-flex items-center">
							<HiOutlineLogout className="mr-2" /> Log Out
						</span>
					</button>
				</>
			) : (
				<>
					<Link
						to="/guest/login"
						className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 font-medium"
						role="menuitem"
						tabIndex={0}
						onClick={() => setProfileDropdownOpen(false)}
					>
						Log In
					</Link>
					<Link
						to="/guest/signup"
						className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
						role="menuitem"
						tabIndex={0}
						onClick={() => setProfileDropdownOpen(false)}
					>
						Sign Up
					</Link>
				</>
			)}
		</div>
	);

	return (
		<>
			<nav className="w-full z-30 border-b border-slate-100 sticky top-0 bg-white">
				<div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 flex items-center justify-between">
					<div className="flex items-center flex-shrink-0 space-x-2">
						<Link to="/" className="flex items-center flex-shrink-0 group">
							<span className="inline-block bg-gradient-to-br from-blue-400 to-sky-600 rounded-lg p-1">
								<HiOutlineHome className="h-7 w-7 text-white drop-shadow-md" />
							</span>
							<span className="ml-2 text-xl tracking-wide font-bold text-slate-800 group-hover:text-sky-600 transition">
								BeachStay Villas
							</span>
						</Link>
					</div>

					<form
						onSubmit={handleSearchSubmit}
						className="hidden md:flex flex-1 justify-center mx-4"
						aria-label="Villa search"
					>
						<div className="flex bg-gray-50 border border-gray-300 rounded-full shadow-sm overflow-hidden py-1 px-2 w-full max-w-xl items-center">
							<input
								type="text"
								name="location"
								value={locationValue}
								onChange={(e) => setLocationValue(e.target.value)}
								placeholder="Search location (e.g. Cancun Beach)"
								className="flex-1 py-1 px-3 text-gray-800 bg-transparent focus:outline-none focus:placeholder:text-gray-500"
								aria-label="Location"
								autoComplete="off"
							/>
							<input
								type="date"
								name="checkin"
								value={checkinValue || ""}
								onChange={(e) => setCheckinValue(e.target.value || null)}
								className="w-32 mr-1 bg-transparent text-gray-700 focus:outline-none cursor-pointer"
								aria-label="Check-in"
								min={format(new Date(), "yyyy-MM-dd")}
							/>
							<input
								type="date"
								name="checkout"
								value={checkoutValue || ""}
								onChange={(e) => setCheckoutValue(e.target.value || null)}
								className="w-32 mr-1 bg-transparent text-gray-700 focus:outline-none cursor-pointer"
								aria-label="Check-out"
								min={checkinValue || format(new Date(), "yyyy-MM-dd")}
							/>
							<input
								type="number"
								name="num_guests"
								min={1}
								max={64}
								value={numGuestsValue}
								onChange={(e) => setNumGuestsValue(Math.max(1, Number(e.target.value)))}
								className="w-16 mx-1 text-center bg-transparent text-gray-700 focus:outline-none"
								aria-label="Guests"
								aria-valuemin={1}
							/>
							<button
								type="submit"
								className="ml-2 flex-shrink-0 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 ml-2 transition focus:ring ring-blue-300"
								aria-label="Search"
							>
								Search
							</button>
						</div>
					</form>

					<div className="flex items-center space-x-2">
						<Link
							to={
								is_authenticated
									? "/host/onboarding"
									: "/guest/login?returnTo=/host/onboarding"
							}
							className="hidden md:inline-flex px-4 py-2 bg-sky-600 text-white font-semibold rounded-full hover:bg-sky-700 transition whitespace-nowrap"
						>
							List Your Villa
						</Link>

						{is_authenticated && (
							<Link
								to="/messaging"
								className="relative flex items-center justify-center text-sky-600 hover:text-sky-700 focus:outline-none mx-1"
								aria-label="Inbox"
							>
								<HiOutlineInbox className="w-7 h-7" />
								{unread_message_count > 0 && (
									<span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
										{unread_message_count}
									</span>
								)}
							</Link>
						)}

						<div className="relative ml-2">
							<button
								ref={profileButtonRef}
								onClick={() => setProfileDropdownOpen((open) => !open)}
								className="flex items-center focus:outline-none focus:ring-2 rounded-full group"
								id="user-menu"
								aria-label="User Profile menu"
								aria-haspopup="true"
								aria-expanded={profileDropdownOpen}
							>
								{is_authenticated ? (
									<>
										<img
											src={profile_photo_url || getDefaultAvatar(user_id || "default")}
											alt="Profile"
											className="h-9 w-9 rounded-full object-cover border border-gray-200"
										/>
										<span className="ml-2 font-semibold text-base text-slate-800 group-hover:text-blue-700 transition">
											{display_name}
										</span>
										{superhost_status && (
											<span
												className="ml-1 px-2 py-0.5 text-xs rounded bg-yellow-300 text-yellow-800 font-semibold border border-yellow-500 ml-1"
												title="Superhost"
											>
												Superhost
											</span>
										)}
									</>
								) : (
									<>
										<HiOutlineUserCircle className="h-9 w-9 text-gray-400" />
									</>
								)}
							</button>
							<Transition
								show={profileDropdownOpen}
								as={React.Fragment}
								enter="transition ease-out duration-150"
								enterFrom="transform opacity-0 scale-95"
								enterTo="transform opacity-100 scale-100"
								leave="transition ease-in duration-100"
								leaveFrom="transform opacity-100 scale-100"
								leaveTo="transform opacity-0 scale-95"
							>
								<div style={{ minWidth: 200 }}>{profileMenu}</div>
							</Transition>
						</div>
						<button
							className="ml-2 p-2 rounded-md md:hidden border border-gray-200 focus:outline-none hover:bg-gray-50"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							aria-label="Open Mobile Menu"
						>
							{mobileMenuOpen ? (
								<HiOutlineX className="w-7 h-7" />
							) : (
								<HiOutlineMenu className="w-7 h-7" />
							)}
						</button>
					</div>
				</div>
				<Transition
					show={mobileMenuOpen}
					as={React.Fragment}
					enter="transition ease-out duration-150"
					enterFrom="transform opacity-0 scale-95"
					enterTo="transform opacity-100 scale-100"
					leave="transition ease-in duration-100"
					leaveFrom="transform opacity-100 scale-100"
					leaveTo="transform opacity-0 scale-95"
				>
					<div className="md:hidden bg-white border-t border-gray-100 px-3 py-4 shadow-lg">
						<form onSubmit={handleSearchSubmit} className="mb-4">
							<div className="flex flex-col gap-2">
								<input
									type="text"
									name="location"
									value={locationValue}
									onChange={(e) => setLocationValue(e.target.value)}
									placeholder="Search location"
									className="bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none"
								/>
								<div className="flex gap-2">
									<input
										type="date"
										name="checkin"
										value={checkinValue || ""}
										onChange={(e) => setCheckinValue(e.target.value || null)}
										className="bg-gray-50 border border-gray-300 rounded-md px-2 py-1 flex-1"
										aria-label="Check-in"
									/>
									<input
										type="date"
										name="checkout"
										value={checkoutValue || ""}
										onChange={(e) => setCheckoutValue(e.target.value || null)}
										className="bg-gray-50 border border-gray-300 rounded-md px-2 py-1 flex-1"
										aria-label="Check-out"
									/>
								</div>
								<input
									type="number"
									name="num_guests"
									min={1}
									value={numGuestsValue}
									onChange={(e) =>
										setNumGuestsValue(Math.max(1, Number(e.target.value)))
									}
									className="bg-gray-50 border border-gray-300 rounded-md px-2 py-1 w-20"
									aria-label="Guests"
								/>
								<button
									type="submit"
									className="mt-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 w-full"
									aria-label="Search"
								>
									Search
								</button>
							</div>
						</form>
						<div className="flex flex-col gap-2 px-1">
							<Link
								to="/"
								className="py-2 text-lg font-medium text-sky-600 hover:underline"
								onClick={() => setMobileMenuOpen(false)}
							>
								Home
							</Link>
							<Link
								to={
									is_authenticated
										? "/host/onboarding"
										: "/guest/login?returnTo=/host/onboarding"
								}
								className="py-2 text-lg font-medium text-blue-600 hover:underline"
								onClick={() => setMobileMenuOpen(false)}
							>
								List Your Villa
							</Link>{" "}
							{is_authenticated ? (
								<>
									{is_host ? (
										<>
											<Link
												to="/host/dashboard"
												className="py-2 text-base text-gray-700"
												onClick={() => setMobileMenuOpen(false)}
											>
												Host Dashboard
											</Link>
											<Link
												to="/host/profile/edit"
												className="py-2 text-base text-gray-700"
												onClick={() => setMobileMenuOpen(false)}
											>
												Edit Profile
											</Link>
										</>
									) : (
										<>
											<Link
												to="/guest/dashboard"
												className="py-2 text-base text-gray-700"
												onClick={() => setMobileMenuOpen(false)}
											>
												Guest Dashboard
											</Link>
											<Link
												to="/guest/my-trips"
												className="py-2 text-base text-gray-700"
												onClick={() => setMobileMenuOpen(false)}
											>
												My Trips
											</Link>
											<Link
												to="/guest/wishlists"
												className="py-2 text-base text-gray-700"
												onClick={() => setMobileMenuOpen(false)}
											>
												Wishlists
											</Link>
											<Link
												to="/guest/profile/edit"
												className="py-2 text-base text-gray-700"
												onClick={() => setMobileMenuOpen(false)}
											>
												Edit Profile
											</Link>
										</>
									)}
									<Link
										to="/messaging"
										className="flex items-center py-2 text-base text-gray-700"
										onClick={() => setMobileMenuOpen(false)}
									>
										<span>Inbox</span>
										{unread_message_count > 0 && (
											<span className="ml-2 px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs">
												{unread_message_count}
											</span>
										)}
									</Link>
									<button
										className="py-2 text-base text-red-600 flex items-center"
										onClick={() => {
											setMobileMenuOpen(false);
											handleLogout();
										}}
									>
										<HiOutlineLogout className="mr-2" /> Log Out
									</button>
								</>
							) : (
								<>
									<Link
										to="/guest/login"
										className="py-2 text-blue-500"
										onClick={() => setMobileMenuOpen(false)}
									>
										Log In
									</Link>
									<Link
										to="/guest/signup"
										className="py-2 text-blue-500"
										onClick={() => setMobileMenuOpen(false)}
									>
										Sign Up
									</Link>
								</>
							)}
						</div>
					</div>
				</Transition>
			</nav>
		</>
	);
};

export default GV_TopNav;
