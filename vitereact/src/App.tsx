import React, { useRef, Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "styled-components"; // Example placeholder, choose your actual theming lib
import { HelmetProvider } from "react-helmet-async"; // For SEO, optional

// Global error boundary
interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

interface ErrorBoundaryProps {
	children: React.ReactNode;
}

class AppErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	state: ErrorBoundaryState = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		// log to service
		// logErrorToService(error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="text-red-600 p-8 text-center">
					<h1>Something went wrong 🙁</h1>
					<pre>{this.state.error?.message}</pre>
					{/* Could render <UV_ErrorState /> instead if desired */}
				</div>
			);
		}
		return this.props.children;
	}
}

// --- Authentication Guard ---
import { useAppStore } from "@/store/main";

interface ProtectedRouteProps {
	children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
	const user_session = useAppStore((state) => state.user_session);
	const [hasHydrated, setHasHydrated] = useState(false);

	// Check if store has been hydrated from localStorage
	useEffect(() => {
		// Simple hydration check - wait for next tick to allow store to hydrate
		const timer = setTimeout(() => {
			setHasHydrated(true);
		}, 50);

		return () => clearTimeout(timer);
	}, []);

	// Show loading while store is hydrating
	if (!hasHydrated) {
		return (
			<div className="flex justify-center items-center h-64 text-gray-500">
				Loading...
			</div>
		);
	}

	// Check authentication after hydration
	if (!user_session.is_authenticated) {
		console.log(
			"ProtectedRoute: User not authenticated, redirecting to login",
			user_session,
		);
		const currentPath = window.location.pathname;
		const returnTo = encodeURIComponent(currentPath);
		return <Navigate to={`/guest/login?returnTo=${returnTo}`} replace />;
	}

	console.log(
		"ProtectedRoute: User authenticated, allowing access",
		user_session,
	);
	return <>{children}</>;
};
/* --- Shared / App-wide components --- */
import GV_TopNav from "@/components/views/GV_TopNav.tsx";
import GV_Footer from "@/components/views/GV_Footer.tsx";
import GV_NotificationBar from "@/components/views/GV_NotificationBar.tsx";

/* --- Unique routed views --- */
// (Optionally lazy-load for improved performance)
import UV_Homepage from "@/components/views/UV_Homepage.tsx";
import UV_SearchResults from "@/components/views/UV_SearchResults.tsx";
import UV_VillaDetails from "@/components/views/UV_VillaDetails.tsx";
import UV_BookingStart from "@/components/views/UV_BookingStart.tsx";
import UV_BookingConfirmation from "@/components/views/UV_BookingConfirmation.tsx";
import UV_BookingFailure from "@/components/views/UV_BookingFailure.tsx";
import UV_GuestSignup from "@/components/views/UV_GuestSignup.tsx";
import UV_GuestLogin from "@/components/views/UV_GuestLogin.tsx";
import UV_PasswordReset from "@/components/views/UV_PasswordReset.tsx";
import UV_GuestDashboard from "@/components/views/UV_GuestDashboard.tsx";
import UV_GuestProfileEdit from "@/components/views/UV_GuestProfileEdit.tsx";
import UV_HostSignup from "@/components/views/UV_HostSignup.tsx";
import UV_HostDashboard from "@/components/views/UV_HostDashboard.tsx";
import UV_HostProfileEdit from "@/components/views/UV_HostProfileEdit.tsx";
import UV_HostOnboardingWizard from "@/components/views/UV_HostOnboardingWizard.tsx";
import UV_HostVillaDetail from "@/components/views/UV_HostVillaDetail.tsx";
import UV_MessagingInbox from "@/components/views/UV_MessagingInbox.tsx";
import UV_MessagingThread from "@/components/views/UV_MessagingThread.tsx";
import UV_LeaveReview from "@/components/views/UV_LeaveReview.tsx";
import UV_ReviewEdit from "@/components/views/UV_ReviewEdit.tsx";
import UV_MyTrips from "@/components/views/UV_MyTrips.tsx";
import UV_HostReservations from "@/components/views/UV_HostReservations.tsx";
import UV_ReservationDetail from "@/components/views/UV_ReservationDetail.tsx";
import UV_Wishlists from "@/components/views/UV_Wishlists.tsx";
import UV_404NotFound from "@/components/views/UV_404NotFound.tsx";
import UV_LegalPolicy from "@/components/views/UV_LegalPolicy.tsx";
import UV_ErrorState from "@/components/views/UV_ErrorState.tsx";

// Replace with your theme object if using theming
const theme = {};

const App: React.FC = () => {
	// Zustand does NOT need a Provider if you use their standard setup
	// If you use SSR or advanced context, you can wrap <ZustandProvider>.
	// https://docs.pmnd.rs/zustand/integrations/context

	// Instantiate only once
	const queryClientRef = useRef<QueryClient>();
	if (!queryClientRef.current) {
		queryClientRef.current = new QueryClient();
	}

	return (
		<React.StrictMode>
			<HelmetProvider>
				<ThemeProvider theme={theme}>
					<AppErrorBoundary>
						{/* NOTE: If you have global CSS reset, include here (Tailwind usually does this) */}

						<BrowserRouter>
							<QueryClientProvider client={queryClientRef.current}>
								<div className="flex flex-col min-h-screen bg-white">
									{/* Persistent Top Navigation */}
									<GV_TopNav />

									{/* Notification Bar - Should be properly portaled/fixed */}
									<GV_NotificationBar />

									{/* Main Content */}
									<div className="flex-1 w-full">
										{/* Suspense enables fallback UI if any child is lazy loaded */}
										<Suspense
											fallback={
												<div className="flex justify-center items-center h-64 text-gray-500">
													Loading...
												</div>
											}
										>
											<Routes>
												{/* Public & Discovery */}
												<Route path="/" element={<UV_Homepage />} />
												<Route path="/search" element={<UV_SearchResults />} />
												<Route path="/villa/:villaId" element={<UV_VillaDetails />} />

												{/* Booking Flows */}
												<Route path="/booking/start" element={<UV_BookingStart />} />
												<Route
													path="/booking/confirmation"
													element={<UV_BookingConfirmation />}
												/>
												<Route path="/booking/failure" element={<UV_BookingFailure />} />

												{/* Guest Auth/Profile/Dashboard (protected as needed) */}
												<Route path="/guest/signup" element={<UV_GuestSignup />} />
												<Route path="/guest/login" element={<UV_GuestLogin />} />
												<Route
													path="/guest/password-reset"
													element={<UV_PasswordReset />}
												/>
												<Route
													path="/guest/dashboard"
													element={
														<ProtectedRoute>
															<UV_GuestDashboard />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/guest/profile/edit"
													element={
														<ProtectedRoute>
															<UV_GuestProfileEdit />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/guest/my-trips"
													element={
														<ProtectedRoute>
															<UV_MyTrips />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/guest/wishlists"
													element={
														<ProtectedRoute>
															<UV_Wishlists />
														</ProtectedRoute>
													}
												/>

												{/* Host Auth/Profile/Dashboard (protected) */}
												<Route path="/host/signup" element={<UV_HostSignup />} />
												<Route
													path="/host/dashboard"
													element={
														<ProtectedRoute>
															<UV_HostDashboard />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/host/profile/edit"
													element={
														<ProtectedRoute>
															<UV_HostProfileEdit />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/host/onboarding"
													element={
														<ProtectedRoute>
															<UV_HostOnboardingWizard />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/host/villa/:villaId"
													element={
														<ProtectedRoute>
															<UV_HostVillaDetail />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/host/reservations"
													element={
														<ProtectedRoute>
															<UV_HostReservations />
														</ProtectedRoute>
													}
												/>

												{/* Messaging (protected) */}
												<Route
													path="/messaging"
													element={
														<ProtectedRoute>
															<UV_MessagingInbox />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/messaging/thread/:threadId"
													element={
														<ProtectedRoute>
															<UV_MessagingThread />
														</ProtectedRoute>
													}
												/>

												{/* Reservation & Review (protected) */}
												<Route
													path="/reservation/:reservationId"
													element={
														<ProtectedRoute>
															<UV_ReservationDetail />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/review/leave/:bookingId"
													element={
														<ProtectedRoute>
															<UV_LeaveReview />
														</ProtectedRoute>
													}
												/>
												<Route
													path="/review/edit/:reviewId"
													element={
														<ProtectedRoute>
															<UV_ReviewEdit />
														</ProtectedRoute>
													}
												/>

												{/* Legal/Static (public) */}
												<Route path="/legal/:policy" element={<UV_LegalPolicy />} />

												{/* Generic/Error/Fallback */}
												<Route path="/error" element={<UV_ErrorState />} />
												<Route path="/404" element={<UV_404NotFound />} />
												<Route path="*" element={<UV_404NotFound />} />
											</Routes>
										</Suspense>
									</div>
									{/* Persistent Footer */}
									<GV_Footer />
								</div>
							</QueryClientProvider>
						</BrowserRouter>
					</AppErrorBoundary>
				</ThemeProvider>
			</HelmetProvider>
		</React.StrictMode>
	);
};

export default App;
