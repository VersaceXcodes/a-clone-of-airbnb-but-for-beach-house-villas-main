import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/main";
import {
	villaSchema,
	amenitySchema,
	villaPhotoSchema,
	villaRuleSchema,
	villaCalendarSchema,
	Villa,
	VillaPhoto,
	Amenity,
	VillaRule,
	VillaCalendar,
} from "@schema";

// --- Types
type WizardStep =
	| 0 // Property Info
	| 1 // Photos
	| 2 // Amenities
	| 3 // Rules/Cancellation
	| 4 // Pricing
	| 5 // Calendar
	| 6; // Preview

const TOTAL_STEPS = 7;
const STEP_LABELS: string[] = [
	"Property Info",
	"Photos",
	"Amenities",
	"House Rules & Cancellation",
	"Pricing",
	"Availability Calendar",
	"Preview & Publish",
];

interface WizardState {
	step_index: WizardStep;
	villa_id: number | null;
	// Step 0
	title: string;
	description_short: string;
	description_long: string;
	address_street: string;
	address_city: string;
	address_area: string;
	address_postal_code: string;
	address_country: string;
	latitude: number;
	longitude: number;
	// Step 1
	photos: {
		villa_photo_id: string;
		photo_url: string;
		ordering: number;
		is_main: boolean;
	}[];
	main_photo_url: string;
	// Step 2
	amenity_ids: number[];
	amenities_options: Amenity[];
	// Step 3
	rules: {
		rule_type: string;
		allowed: boolean;
		notes: string | null;
	}[];
	cancellation_policy: string;
	house_rules: string;
	// Step 4
	price_per_night: number;
	cleaning_fee: number;
	service_fee: number;
	taxes: number;
	min_nights: number;
	max_nights: number;
	bedrooms: number;
	beds: number;
	bathrooms: number;
	max_guests: number;
	is_active: boolean;
	is_beachfront: boolean;
	is_pet_friendly: boolean;
	is_instant_book: boolean;
	// Step 5
	calendar_data: {
		date: string;
		is_available: boolean;
		reason: string | null;
	}[];
	// General
	loading: boolean;
	error: string | null;
}

// --- Backend URL
const API_BASE =
	import.meta.env.VITE_API_BASE_URL ||
	"https://123testing-project-yes-api.launchpulse.ai/api";
console.log("HostOnboardingWizard: API_BASE configured as:", API_BASE);

// --- Helper (for uploading + image management; can only store URLs, no actual upload)
const randomPhotoUrl = (seed = Math.floor(Math.random() * 10000)) =>
	`https://picsum.photos/seed/beachstay_${seed}/800/600`;

// --- Component
const UV_HostOnboardingWizard: React.FC = () => {
	// --- Routing & Session
	const navigate = useNavigate();
	// Accept either /host/onboarding (new) or /host/villa/:villaId/edit (edit)
	const { villaId: slugVillaId } = useParams<{ villaId?: string }>();
	const is_edit_mode = !!slugVillaId;
	const parsedSlugVillaId =
		slugVillaId && !isNaN(Number(slugVillaId)) ? parseInt(slugVillaId, 10) : null;
	// Global state: authentication, user id, token
	const user_session = useAppStore((state) => state.user_session);

	const initialVillaId: number | null = parsedSlugVillaId;
	const initialUserId: number | null =
		user_session.user_id !== null && !isNaN(Number(user_session.user_id))
			? Number(user_session.user_id)
			: null;

	// --- Local Wizard State
	const [wizard, setWizard] = useState<WizardState>({
		// Step control
		step_index: 0,
		villa_id: initialVillaId,
		// Property Info
		title: "",
		description_short: "",
		description_long: "",
		address_street: "",
		address_city: "",
		address_area: "",
		address_postal_code: "",
		address_country: "",
		latitude: 0,
		longitude: 0,
		// Photos
		photos: [],
		main_photo_url: "",
		// Amenities
		amenity_ids: [],
		amenities_options: [],
		// Rules
		rules: [],
		cancellation_policy: "",
		house_rules: "",
		// Pricing
		price_per_night: 0,
		cleaning_fee: 0,
		service_fee: 0,
		taxes: 0,
		min_nights: 1,
		max_nights: 14,
		bedrooms: 1,
		beds: 1,
		bathrooms: 1,
		max_guests: 1,
		is_active: true,
		is_beachfront: false,
		is_pet_friendly: false,
		is_instant_book: false,
		// Calendar
		calendar_data: [],
		// Utility
		loading: false,
		error: null,
	});

	// --- Master amenities (pulled always for step 2)
	const {
		data: masterAmenities,
		isFetching: amenitiesLoading,
		error: amenitiesError,
	} = useQuery<Amenity[], Error>({
		queryKey: ["amenities_global"],
		queryFn: async () => {
			try {
				console.log(
					"HostOnboardingWizard: Fetching amenities from:",
					`${API_BASE}/villas/amenities`,
				);
				const res = await axios.get(`${API_BASE}/villas/amenities`, {
					timeout: 10000,
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
					},
				});
				console.log("HostOnboardingWizard: Amenities response:", res.data);
				// Validate and return
				return z.array(amenitySchema).parse(res.data);
			} catch (error) {
				console.error("HostOnboardingWizard: Error fetching amenities:", error);
				throw error;
			}
		},
		retry: 3,
		retryDelay: 1000,
	});

	// --- Populate fields for EDIT mode ---
	// Fetch main villa info if editing, only once
	const didPrefill = useRef(false);
	useEffect(() => {
		if (!is_edit_mode || !parsedSlugVillaId || didPrefill.current) return;
		(async () => {
			setWizard((wz) => ({ ...wz, loading: true, error: null }));
			try {
				console.log(
					"HostOnboardingWizard: Loading villa data for edit mode, villa ID:",
					parsedSlugVillaId,
				);
				// Main villa object
				const res_villa = await axios.get(
					`${API_BASE}/villa/${parsedSlugVillaId}`,
					{
						timeout: 10000,
						headers: {
							Accept: "application/json",
							"Content-Type": "application/json",
						},
					},
				);
				console.log("HostOnboardingWizard: Villa data response:", res_villa.data);
				const villa: Villa = villaSchema.parse(res_villa.data);

				// Photos
				const res_photos = await axios.get(
					`${API_BASE}/villa/${parsedSlugVillaId}/photos`,
				);
				const photos: VillaPhoto[] = z
					.array(villaPhotoSchema)
					.parse(res_photos.data);
				// Set ordering, is_main
				const wizardPhotos = photos.map((p, idx) => ({
					villa_photo_id: String(p.villa_photo_id),
					photo_url: p.photo_url,
					ordering: Number(p.ordering),
					is_main: p.is_main,
				}));

				// Amenities (just amenity_id[] in this wizard)
				const res_amenities = await axios.get(
					`${API_BASE}/villa/${parsedSlugVillaId}/amenities`,
				);
				const villaAmenities: Amenity[] = z
					.array(amenitySchema)
					.parse(res_amenities.data);
				const amenity_ids = villaAmenities.map((a) => Number(a.amenity_id));

				// Rules
				const res_rules = await axios.get(
					`${API_BASE}/villa/${parsedSlugVillaId}/rules`,
				);
				const rules: VillaRule[] = z.array(villaRuleSchema).parse(res_rules.data);
				const wizardRules = rules.map((r) => ({
					rule_type: r.rule_type,
					allowed: r.allowed,
					notes: r.notes,
				}));

				// Calendar
				const res_cal = await axios.get(
					`${API_BASE}/villa/${parsedSlugVillaId}/calendar`,
				);
				const calendar: VillaCalendar[] = z
					.array(villaCalendarSchema)
					.parse(res_cal.data);

				setWizard((prev) => ({
					...prev,
					villa_id: Number(villa.villa_id),
					title: villa.title,
					description_short: villa.description_short || "",
					description_long: villa.description_long || "",
					address_street: villa.address_street || "",
					address_city: villa.address_city,
					address_area: villa.address_area || "",
					address_postal_code: villa.address_postal_code || "",
					address_country: villa.address_country,
					latitude: villa.latitude,
					longitude: villa.longitude,
					main_photo_url:
						villa.main_photo_url ||
						(wizardPhotos.find((p) => p.is_main)?.photo_url ?? ""),
					photos: wizardPhotos,
					amenity_ids,
					rules: wizardRules,
					cancellation_policy: villa.cancellation_policy,
					house_rules: villa.house_rules || "",
					price_per_night: villa.price_per_night,
					cleaning_fee: villa.cleaning_fee,
					service_fee: villa.service_fee,
					taxes: villa.taxes,
					min_nights: villa.min_nights,
					max_nights: villa.max_nights,
					bedrooms: villa.bedrooms,
					beds: villa.beds,
					bathrooms: villa.bathrooms,
					max_guests: villa.max_guests,
					is_active: villa.is_active,
					is_beachfront: villa.is_beachfront,
					is_pet_friendly: villa.is_pet_friendly,
					is_instant_book: villa.is_instant_book,
					calendar_data: calendar.map((c) => ({
						date: c.date,
						is_available: c.is_available,
						reason: c.reason,
					})),
					loading: false,
					error: null,
				}));
				didPrefill.current = true;
			} catch (e: any) {
				console.error("HostOnboardingWizard: Error loading villa data:", e);
				const errorMessage =
					e?.response?.data?.error ||
					e?.response?.data?.message ||
					e?.message ||
					"Failed to load villa data. Please check your connection and try again.";
				setWizard((prev) => ({
					...prev,
					loading: false,
					error: errorMessage,
				}));
			}
		})();
	}, [is_edit_mode, parsedSlugVillaId]);

	// -- Load amenities master on mount
	useEffect(() => {
		if (masterAmenities && masterAmenities.length > 0) {
			setWizard((prev) => ({ ...prev, amenities_options: masterAmenities }));
		}
	}, [masterAmenities?.length]);

	// --- STEP VALIDATION (Dynamic) ---
	function isStepValid(idx: WizardStep, w: WizardState): boolean {
		switch (idx) {
			case 0:
				return (
					w.title.trim().length > 3 &&
					w.address_city.trim().length > 1 &&
					w.address_country.trim().length > 1
				);
			case 1:
				return (
					w.photos.length >= 5 &&
					w.photos.length <= 20 &&
					w.photos.some((p) => p.is_main)
				);
			case 2:
				return w.amenity_ids.length > 0;
			case 3:
				return (
					["flexible", "moderate", "strict"].includes(w.cancellation_policy) &&
					w.rules.length > 0
				);
			case 4:
				return (
					w.price_per_night > 0 &&
					w.cleaning_fee >= 0 &&
					w.service_fee >= 0 &&
					w.taxes >= 0 &&
					w.min_nights > 0 &&
					w.max_nights >= w.min_nights &&
					w.bedrooms > 0 &&
					w.beds > 0 &&
					w.bathrooms > 0 &&
					w.max_guests > 0
				);
			case 5:
				return w.calendar_data.length > 0; // can just check any data for now
			case 6:
				// Preview step, always valid if past steps are
				return true;
			default:
				return false;
		}
	}

	// --- Step navigation ---
	function goToStep(idx: number) {
		setWizard((prev) => ({
			...prev,
			step_index: Math.max(0, Math.min(TOTAL_STEPS - 1, idx)),
			error: null,
		}));
	}
	function nextStep() {
		setWizard((prev) => ({
			...prev,
			step_index: Math.min(TOTAL_STEPS - 1, prev.step_index + 1),
			error: null,
		}));
	}
	function prevStep() {
		setWizard((prev) => ({
			...prev,
			step_index: Math.max(0, prev.step_index - 1),
			error: null,
		}));
	}

	// --- API Mutations (create, edit, calendar) ---
	const queryClient = useQueryClient();

	// --- Create mutation (POST /host/villas)
	const createVillaMutation = useMutation({
		mutationFn: async (payload: any) => {
			try {
				console.log("HostOnboardingWizard: Creating villa with payload:", payload);
				const res = await axios.post(`${API_BASE}/host/villas`, payload, {
					headers: {
						Authorization: `Bearer ${user_session.token || ""}`,
						Accept: "application/json",
						"Content-Type": "application/json",
					},
					timeout: 30000,
				});
				console.log("HostOnboardingWizard: Villa creation response:", res.data);
				// Returns the new villa
				return villaSchema.parse(res.data);
			} catch (error) {
				console.error("HostOnboardingWizard: Error creating villa:", error);
				throw error;
			}
		},
		onSuccess: (data) => {
			console.log("HostOnboardingWizard: Villa created successfully:", data);
			queryClient.invalidateQueries({ queryKey: ["host_villas"] });
			setWizard((prev) => ({
				...prev,
				villa_id: Number(data.villa_id),
				loading: false,
			}));
			navigate(`/host/villa/${data.villa_id}`); // Go to villa detail
		},
		onError: (err: any) => {
			console.error("HostOnboardingWizard: Villa creation failed:", err);
			const errorMessage =
				err?.response?.data?.error ||
				err?.response?.data?.message ||
				err?.message ||
				"Failed to create listing. Please check your connection and try again.";
			setWizard((prev) => ({
				...prev,
				loading: false,
				error: errorMessage,
			}));
		},
	});

	// --- Edit mutation (PATCH /villa/:id)
	const editVillaMutation = useMutation({
		mutationFn: async (payload: any) => {
			if (!wizard.villa_id) throw new Error("Missing villa id for edit");
			const fullBody = {
				villa_id: wizard.villa_id,
				owner_user_id: initialUserId,
				title: wizard.title,
				description_short: wizard.description_short,
				description_long: wizard.description_long,
				address_street: wizard.address_street,
				address_city: wizard.address_city,
				address_area: wizard.address_area,
				address_postal_code: wizard.address_postal_code,
				address_country: wizard.address_country,
				latitude: wizard.latitude,
				longitude: wizard.longitude,
				main_photo_url: wizard.main_photo_url,
				cancellation_policy: wizard.cancellation_policy,
				house_rules: wizard.house_rules,
				min_nights: wizard.min_nights,
				max_nights: wizard.max_nights,
				bedrooms: wizard.bedrooms,
				beds: wizard.beds,
				bathrooms: wizard.bathrooms,
				max_guests: wizard.max_guests,
				price_per_night: wizard.price_per_night,
				cleaning_fee: wizard.cleaning_fee,
				service_fee: wizard.service_fee,
				taxes: wizard.taxes,
				is_active: wizard.is_active,
				is_beachfront: wizard.is_beachfront,
				is_pet_friendly: wizard.is_pet_friendly,
				is_instant_book: wizard.is_instant_book,
				published_at: null,
				created_at: "",
				updated_at: "",
			};
			const res = await axios.patch(
				`${API_BASE}/villa/${wizard.villa_id}`,
				fullBody,
				{
					headers: { Authorization: `Bearer ${user_session.token || ""}` },
				},
			);
			return villaSchema.parse(res.data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["host_villas"] });
			setWizard((prev) => ({ ...prev, loading: false }));
			navigate(`/host/villa/${wizard.villa_id}`); // Go to villa detail
		},
		onError: (err: any) => {
			setWizard((prev) => ({
				...prev,
				loading: false,
				error: err?.response?.data?.error || "Failed to save changes.",
			}));
		},
	});

	// --- Calendar PATCH (edit mode only)
	const updateCalendarMutation = useMutation({
		mutationFn: async (days: any[]) => {
			if (!wizard.villa_id) throw new Error("Missing id");
			const res = await axios.patch(
				`${API_BASE}/villa/${wizard.villa_id}/calendar`,
				days,
				{
					headers: {
						Authorization: `Bearer ${user_session.token || ""}`,
						"Content-Type": "application/json",
					},
				},
			);
			return z.array(villaCalendarSchema).parse(res.data);
		},
		onSuccess: () => {
			setWizard((prev) => ({ ...prev, loading: false }));
		},
		onError: (err: any) => {
			setWizard((prev) => ({
				...prev,
				loading: false,
				error: err?.response?.data?.error || "Failed to update calendar.",
			}));
		},
	});

	// --- Input Handlers ---
	function inputChange(field: keyof WizardState, value: any) {
		setWizard((prev) => ({
			...prev,
			[field]: value,
			error: null,
		}));
	}

	// --- Restrictions for edit mode ---
	function isInputDisabledOnEdit(): boolean {
		return is_edit_mode;
	}

	// --- Step 1: Photo management ---
	// "Uploads" are just text fields for image URLs
	function addPhotoUrl(url: string) {
		if (is_edit_mode) return;
		setWizard((prev) => {
			if (prev.photos.length >= 20) return prev;
			const newPhoto = {
				villa_photo_id: `local_${Math.random().toString(36).substr(2, 10)}`,
				photo_url: url,
				ordering: prev.photos.length + 1,
				is_main: prev.photos.length === 0,
			};
			return {
				...prev,
				photos: [...prev.photos, newPhoto],
				main_photo_url:
					prev.main_photo_url ||
					(prev.photos.length === 0 ? url : prev.main_photo_url),
				error: null,
			};
		});
	}
	function removePhoto(idx: number) {
		if (is_edit_mode) return;
		setWizard((prev) => {
			let arr = prev.photos.slice();
			arr.splice(idx, 1);
			// Update ordering, ensure there's still a main photo
			let hadMain = arr.some((p) => p.is_main);
			if (!hadMain && arr.length > 0) arr[0].is_main = true;
			return {
				...prev,
				photos: arr.map((p, idx2) => ({ ...p, ordering: idx2 + 1 })),
				main_photo_url: arr.find((p) => p.is_main)?.photo_url ?? "",
			};
		});
	}
	function setMainPhoto(idx: number) {
		if (is_edit_mode) return;
		setWizard((prev) => {
			const arr = prev.photos.map((p, i) => ({ ...p, is_main: i === idx }));
			return {
				...prev,
				photos: arr,
				main_photo_url: arr[idx]?.photo_url,
			};
		});
	}
	function movePhoto(idx: number, dir: number) {
		if (is_edit_mode) return;
		setWizard((prev) => {
			let arr = prev.photos.slice();
			if (idx + dir < 0 || idx + dir >= arr.length) return prev;
			[arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
			arr = arr.map((p, i) => ({ ...p, ordering: i + 1 }));
			return { ...prev, photos: arr };
		});
	}

	// --- Step 2: Amenity selection ---
	function toggleAmenity(id: number) {
		if (is_edit_mode) return;
		setWizard((prev) => {
			let current = new Set(prev.amenity_ids);
			if (current.has(id)) current.delete(id);
			else current.add(id);
			return { ...prev, amenity_ids: Array.from(current) };
		});
	}

	// --- Step 3: Rule management ---
	// Provide default rule set for new listings
	const DEFAULT_RULES = [
		{ rule_type: "no_smoking", allowed: false, notes: "" },
		{ rule_type: "pets_allowed", allowed: false, notes: "" },
		{ rule_type: "parties_allowed", allowed: false, notes: "" },
		{ rule_type: "quiet_hours", allowed: true, notes: "" },
		{ rule_type: "children_welcome", allowed: true, notes: "" },
	];
	useEffect(() => {
		if (wizard.step_index === 3 && wizard.rules.length === 0 && !is_edit_mode) {
			setWizard((prev) => ({
				...prev,
				rules: DEFAULT_RULES,
			}));
		}
	}, [wizard.step_index, is_edit_mode]);

	function editRule(idx: number, field: "allowed" | "notes", value: any) {
		if (is_edit_mode) return;
		setWizard((prev) => {
			let arr = prev.rules.slice();
			arr[idx] = { ...arr[idx], [field]: value };
			return { ...prev, rules: arr };
		});
	}
	function addCustomRule() {
		if (is_edit_mode) return;
		setWizard((prev) => ({
			...prev,
			rules: [
				...prev.rules,
				{ rule_type: `custom_${prev.rules.length}`, allowed: true, notes: "" },
			],
		}));
	}
	function removeRule(idx: number) {
		if (is_edit_mode) return;
		setWizard((prev) => {
			let arr = prev.rules.slice();
			arr.splice(idx, 1);
			return { ...prev, rules: arr };
		});
	}

	// ---- Step 5: Calendar ---
	// List of days with is_available and reason
	// For create: just allow a simple range (e.g. next 30 days), all available by default
	useEffect(() => {
		if (
			wizard.step_index === 5 &&
			!is_edit_mode &&
			wizard.calendar_data.length === 0
		) {
			// Next 60 days, all available
			const days: {
				date: string;
				is_available: boolean;
				reason: string | null;
			}[] = [];
			const today = new Date();
			for (let i = 0; i < 60; i++) {
				const d = new Date(today.getTime() + i * 86400000);
				const dateString = d.toISOString().slice(0, 10);
				days.push({ date: dateString, is_available: true, reason: null });
			}
			setWizard((prev) => ({ ...prev, calendar_data: days }));
		}
	}, [wizard.step_index, is_edit_mode, wizard.calendar_data.length]);

	function toggleCalendarDay(idx: number) {
		setWizard((prev) => {
			let arr = prev.calendar_data.slice();
			arr[idx] = {
				...arr[idx],
				is_available: !arr[idx].is_available,
				reason: !arr[idx].is_available ? null : "Host blocked",
			};
			return { ...prev, calendar_data: arr };
		});
	}

	// --- Submit (Create/Edit) ---
	function handlePublish() {
		setWizard((prev) => ({ ...prev, loading: true, error: null }));
		// Create flow:
		if (!is_edit_mode) {
			// Validate all steps
			for (let i = 0; i <= 5; i++) {
				if (!isStepValid(i as WizardStep, wizard)) {
					setWizard((prev) => ({
						...prev,
						loading: false,
						error: "Some steps are incomplete or have invalid data.",
					}));
					return;
				}
			}
			createVillaMutation.mutate({
				owner_user_id: initialUserId,
				title: wizard.title,
				description_short: wizard.description_short,
				description_long: wizard.description_long,
				address_street: wizard.address_street,
				address_city: wizard.address_city,
				address_area: wizard.address_area,
				address_postal_code: wizard.address_postal_code,
				address_country: wizard.address_country,
				latitude: wizard.latitude,
				longitude: wizard.longitude,
				main_photo_url: wizard.main_photo_url,
				cancellation_policy: wizard.cancellation_policy,
				min_nights: wizard.min_nights,
				max_nights: wizard.max_nights,
				bedrooms: wizard.bedrooms,
				beds: wizard.beds,
				bathrooms: wizard.bathrooms,
				max_guests: wizard.max_guests,
				price_per_night: wizard.price_per_night,
				cleaning_fee: wizard.cleaning_fee,
				service_fee: wizard.service_fee,
				taxes: wizard.taxes,
				is_active: wizard.is_active,
				is_beachfront: wizard.is_beachfront,
				is_pet_friendly: wizard.is_pet_friendly,
				is_instant_book: wizard.is_instant_book,
				house_rules: wizard.house_rules,
				photos: wizard.photos,
				amenity_ids: wizard.amenity_ids,
				rules: wizard.rules,
				calendar_data: wizard.calendar_data,
			});
		} else {
			editVillaMutation.mutate({});
			updateCalendarMutation.mutate(wizard.calendar_data);
		}
	}

	// --- Redirect unauthenticated users to login with return URL
	useEffect(() => {
		// Add a small delay to allow store hydration
		const timer = setTimeout(() => {
			if (!user_session.is_authenticated) {
				console.log(
					"HostOnboardingWizard: User not authenticated, redirecting to login",
				);
				navigate("/guest/login?returnTo=" + encodeURIComponent("/host/onboarding"));
			} else if (user_session.is_authenticated && !user_session.is_host) {
				console.log(
					"HostOnboardingWizard: User not a host, redirecting to host signup",
				);
				navigate("/host/signup");
			} else {
				console.log(
					"HostOnboardingWizard: User authenticated and is host, allowing access",
				);
			}
		}, 100);

		return () => clearTimeout(timer);
	}, [user_session.is_authenticated, user_session.is_host, navigate]);

	// --- Early return for unauthenticated users to prevent rendering issues
	if (!user_session.is_authenticated) {
		return (
			<div className="max-w-3xl mx-auto py-8 px-4">
				<div className="flex justify-center items-center h-64 text-gray-500">
					<div className="text-center">
						<div className="animate-spin rounded-full border-4 border-blue-300 border-t-blue-600 w-12 h-12 mx-auto mb-4"></div>
						<p>Checking authentication...</p>
					</div>
				</div>
			</div>
		);
	}

	if (user_session.is_authenticated && !user_session.is_host) {
		return (
			<div className="max-w-3xl mx-auto py-8 px-4">
				<div className="flex justify-center items-center h-64 text-gray-500">
					<div className="text-center">
						<div className="animate-spin rounded-full border-4 border-blue-300 border-t-blue-600 w-12 h-12 mx-auto mb-4"></div>
						<p>Redirecting to host signup...</p>
					</div>
				</div>
			</div>
		);
	}

	// --- RENDER (one big render block, step-by-step, many conditionals) ---
	try {
		return (
			<>
				<div className="max-w-3xl mx-auto py-8 px-4">
					{/* Progress bar + stepper */}
					<div className="mb-6">
						<div className="flex items-center justify-between text-xs font-semibold text-gray-700">
							{STEP_LABELS.map((label, i) => (
								<div key={label} className="flex-1">
									<div className="flex items-center">
										<div
											className={
												"rounded-full border-2 w-8 h-8 flex items-center justify-center mr-2 " +
												(i === wizard.step_index
													? "border-blue-600 text-blue-700 bg-blue-100"
													: i < wizard.step_index
														? "border-green-500 text-green-600 bg-green-100"
														: "border-gray-200 text-gray-400 bg-gray-100")
											}
											aria-label={`Step ${i + 1}: ${label}`}
										>
											{i + 1}
										</div>
										<span
											className={
												(i === wizard.step_index ? "text-blue-700" : "text-gray-500") +
												" whitespace-nowrap"
											}
										>
											{label}
										</span>
									</div>
									{i < TOTAL_STEPS - 1 && (
										<div className="h-1 bg-gray-200 my-1 mx-4 rounded-full" />
									)}
								</div>
							))}
						</div>
					</div>

					{/* Error boundary section for wizard */}
					{wizard.error && (
						<div className="mb-4 p-3 rounded bg-red-50 text-red-700 font-semibold border border-red-300">
							{wizard.error}
						</div>
					)}

					{/* Loading overlays for critical steps */}
					{(wizard.loading || amenitiesLoading) && (
						<div className="absolute left-0 top-0 w-full h-full bg-white/60 z-50 flex items-center justify-center">
							<div className="animate-spin rounded-full border-4 border-blue-300 border-t-blue-600 w-12 h-12"></div>
						</div>
					)}

					{/* STEP PANELS */}
					<div className="mt-2 mb-8">
						{wizard.step_index === 0 && (
							<div>
								<h2 className="text-xl font-bold mb-4">Property Info</h2>
								<div className="grid grid-cols-1 gap-3">
									<div>
										<label className="font-semibold" htmlFor="wizard_title">
											Title*
										</label>
										<input
											className="input input-bordered w-full mt-1"
											id="wizard_title"
											value={wizard.title}
											maxLength={255}
											onChange={(e) => inputChange("title", e.target.value)}
											placeholder="e.g. Beachfront Oasis"
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="wizard_desc_short">
											Short Description*
										</label>
										<textarea
											className="input input-bordered w-full mt-1"
											id="wizard_desc_short"
											value={wizard.description_short}
											maxLength={500}
											onChange={(e) => inputChange("description_short", e.target.value)}
											placeholder="A quick teaser about your villa."
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="wizard_desc_long">
											Detailed Description*
										</label>
										<textarea
											className="input input-bordered w-full mt-1"
											id="wizard_desc_long"
											value={wizard.description_long}
											maxLength={4096}
											onChange={(e) => inputChange("description_long", e.target.value)}
											rows={5}
											placeholder="Describe your villa in detail..."
										/>
									</div>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
										<div>
											<label className="font-semibold" htmlFor="wizard_street">
												Street
											</label>
											<input
												className="input input-bordered w-full mt-1"
												id="wizard_street"
												value={wizard.address_street}
												maxLength={255}
												onChange={(e) => inputChange("address_street", e.target.value)}
												placeholder="123 Beach Ave"
											/>
										</div>
										<div>
											<label className="font-semibold" htmlFor="wizard_city">
												City*
											</label>
											<input
												className="input input-bordered w-full mt-1"
												id="wizard_city"
												value={wizard.address_city}
												maxLength={255}
												onChange={(e) => inputChange("address_city", e.target.value)}
												placeholder="Miami"
											/>
										</div>
										<div>
											<label className="font-semibold" htmlFor="wizard_area">
												Area/Neighborhood
											</label>
											<input
												className="input input-bordered w-full mt-1"
												id="wizard_area"
												value={wizard.address_area}
												maxLength={255}
												onChange={(e) => inputChange("address_area", e.target.value)}
												placeholder="South Beach"
											/>
										</div>
										<div>
											<label className="font-semibold" htmlFor="wizard_postal">
												Postal
											</label>
											<input
												className="input input-bordered w-full mt-1"
												id="wizard_postal"
												value={wizard.address_postal_code}
												maxLength={16}
												onChange={(e) => inputChange("address_postal_code", e.target.value)}
											/>
										</div>
										<div>
											<label className="font-semibold" htmlFor="wizard_country">
												Country*
											</label>
											<input
												className="input input-bordered w-full mt-1"
												id="wizard_country"
												value={wizard.address_country}
												maxLength={64}
												onChange={(e) => inputChange("address_country", e.target.value)}
												placeholder="USA"
											/>
										</div>
										<div>
											<label className="font-semibold" htmlFor="wizard_lat">
												Latitude
											</label>
											<input
												className="input input-bordered w-full mt-1"
												type="number"
												id="wizard_lat"
												value={wizard.latitude}
												onChange={(e) => inputChange("latitude", Number(e.target.value))}
												step={0.000001}
												placeholder="25.790654"
											/>
										</div>
										<div>
											<label className="font-semibold" htmlFor="wizard_lng">
												Longitude
											</label>
											<input
												className="input input-bordered w-full mt-1"
												type="number"
												id="wizard_lng"
												value={wizard.longitude}
												onChange={(e) => inputChange("longitude", Number(e.target.value))}
												step={0.000001}
												placeholder="-80.1300455"
											/>
										</div>
									</div>
								</div>
							</div>
						)}

						{wizard.step_index === 1 && (
							<div>
								<h2 className="text-xl font-bold mb-4">Photos</h2>
								<div className="mb-3">
									<span className="font-semibold">Add photo URLs (min 5, max 20)</span>
									<div className="flex flex-col md:flex-row gap-4 mt-2">
										<input
											type="url"
											className="input input-bordered grow"
											placeholder="Paste an image URL here"
											aria-label="Photo URL input"
											disabled={is_edit_mode}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" &&
													e.currentTarget.value.trim() &&
													!is_edit_mode
												) {
													addPhotoUrl(e.currentTarget.value.trim());
													e.currentTarget.value = "";
												}
											}}
										/>
										<button
											className="btn btn-secondary"
											disabled={is_edit_mode}
											aria-disabled={is_edit_mode}
											onClick={() => {
												if (!is_edit_mode) addPhotoUrl(randomPhotoUrl());
											}}
										>
											Add Random Image
										</button>
									</div>
								</div>
								<div>
									<div className="flex flex-wrap gap-4">
										{wizard.photos.map((p, idx) => (
											<div key={p.villa_photo_id} className="relative group">
												<img
													src={p.photo_url}
													alt="Villa"
													className={`w-40 h-28 object-cover rounded border-2 ${p.is_main ? "border-blue-500" : "border-gray-300"}`}
												/>
												<button
													className="absolute top-1 right-1 text-xs bg-white px-2 py-1 rounded shadow hover:bg-red-500 hover:text-white"
													aria-label={`Remove photo ${idx + 1}`}
													onClick={() => removePhoto(idx)}
													disabled={is_edit_mode}
													aria-disabled={is_edit_mode}
												>
													×
												</button>
												<button
													className={`absolute bottom-1 left-1 text-xs px-2 py-1 rounded-md ${p.is_main ? "bg-blue-600 text-white" : "bg-gray-200"} `}
													aria-label="Set as main photo"
													disabled={is_edit_mode}
													aria-disabled={is_edit_mode}
													onClick={() => setMainPhoto(idx)}
												>
													Main
												</button>
												<div className="absolute bottom-1 right-1 flex gap-1">
													<button
														onClick={() => movePhoto(idx, -1)}
														disabled={idx === 0 || is_edit_mode}
														aria-disabled={idx === 0 || is_edit_mode}
														className="bg-white rounded px-2 py-1 text-xs shadow disabled:opacity-40"
													>
														↑
													</button>
													<button
														onClick={() => movePhoto(idx, +1)}
														disabled={idx === wizard.photos.length - 1 || is_edit_mode}
														aria-disabled={idx === wizard.photos.length - 1 || is_edit_mode}
														className="bg-white rounded px-2 py-1 text-xs shadow disabled:opacity-40"
													>
														↓
													</button>
												</div>
											</div>
										))}
									</div>
									{wizard.photos.length < 5 && (
										<div className="mt-2 text-sm text-red-600">
											Add at least 5 photos (URLs)
										</div>
									)}
								</div>
								{is_edit_mode && (
									<div className="mt-4 text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200 text-sm">
										<b>Note:</b> You may only change the photo order/main photo on new
										listings. Photo management for existing villas is not supported in
										this MVP.
									</div>
								)}
							</div>
						)}

						{wizard.step_index === 2 && (
							<div>
								<h2 className="text-xl font-bold mb-4">Amenities</h2>
								{amenitiesError && (
									<div className="text-red-700 mb-2">{String(amenitiesError)}</div>
								)}
								<div className="flex flex-wrap gap-2">
									{wizard.amenities_options.map((a) => {
										const checkboxId = `amenity_id_checkbox_${a.amenity_id}`;
										return (
											<label
												key={a.amenity_id}
												htmlFor={checkboxId}
												className={
													"inline-flex items-center border rounded px-3 py-2 cursor-pointer " +
													(wizard.amenity_ids.includes(a.amenity_id)
														? "bg-blue-100 border-blue-400"
														: "border-gray-300") +
													(is_edit_mode ? " opacity-50 pointer-events-none" : "")
												}
											>
												<input
													type="checkbox"
													id={checkboxId}
													className="mr-2"
													checked={wizard.amenity_ids.includes(a.amenity_id)}
													onChange={() => toggleAmenity(a.amenity_id)}
													disabled={is_edit_mode}
													aria-disabled={is_edit_mode}
													aria-label={a.label}
												/>
												{a.icon_url && (
													<img src={a.icon_url} alt="" className="w-5 h-5 mr-1" />
												)}
												{a.label}
											</label>
										);
									})}
								</div>
								{is_edit_mode && (
									<div className="mt-4 text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200 text-sm">
										<b>Note:</b> You may only set amenities on new listings. Updating
										amenities is not supported for existing villas in this MVP.
									</div>
								)}
							</div>
						)}

						{wizard.step_index === 3 && (
							<div>
								<h2 className="text-xl font-bold mb-4">House Rules & Cancellation</h2>
								<div>
									<label className="font-semibold" htmlFor="cancellation_policy">
										Cancellation Policy*
									</label>
									<select
										className="input input-bordered w-full mt-1"
										id="cancellation_policy"
										value={wizard.cancellation_policy}
										onChange={(e) => inputChange("cancellation_policy", e.target.value)}
										disabled={is_edit_mode}
										aria-disabled={is_edit_mode}
									>
										<option value="">Select...</option>
										<option value="flexible">Flexible</option>
										<option value="moderate">Moderate</option>
										<option value="strict">Strict</option>
									</select>
								</div>
								<div className="mt-3">
									<span className="font-semibold">Rules checklist</span>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{wizard.rules.map((r, idx) => {
											const cbId = `rule_allowed_${r.rule_type}_${idx}`;
											const noteId = `rule_note_${r.rule_type}_${idx}`;
											return (
												<div
													key={r.rule_type + idx}
													className="flex items-center justify-between border rounded px-2 py-1"
												>
													<div>
														<span className="capitalize font-medium">
															{r.rule_type.replace(/_/g, " ")}
														</span>
														<input
															type="checkbox"
															id={cbId}
															className="ml-2"
															checked={!!r.allowed}
															onChange={() => editRule(idx, "allowed", !r.allowed)}
															disabled={is_edit_mode}
															aria-disabled={is_edit_mode}
														/>
													</div>
													<input
														type="text"
														className="input input-bordered ml-3"
														id={noteId}
														value={r.notes || ""}
														placeholder="Notes"
														onChange={(e) => editRule(idx, "notes", e.target.value)}
														style={{ width: "150px" }}
														disabled={is_edit_mode}
														aria-disabled={is_edit_mode}
													/>
													<button
														className="ml-2 text-red-500 hover:text-red-700"
														onClick={() => removeRule(idx)}
														aria-label="Remove rule"
														type="button"
														disabled={is_edit_mode}
														aria-disabled={is_edit_mode}
													>
														×
													</button>
												</div>
											);
										})}
									</div>
									<button
										className="btn btn-secondary mt-2"
										onClick={addCustomRule}
										type="button"
										disabled={is_edit_mode}
										aria-disabled={is_edit_mode}
									>
										Add Custom Rule
									</button>
								</div>
								<div className="mt-3">
									<label className="font-semibold" htmlFor="additional_house_rules">
										Additional House Rules
									</label>
									<textarea
										className="input input-bordered w-full"
										id="additional_house_rules"
										value={wizard.house_rules}
										maxLength={2048}
										onChange={(e) => inputChange("house_rules", e.target.value)}
										rows={2}
										disabled={is_edit_mode}
										aria-disabled={is_edit_mode}
										placeholder="Summarize any other special rules (e.g. late check-in policy)."
									/>
								</div>
								{is_edit_mode && (
									<div className="mt-4 text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200 text-sm">
										<b>Note:</b> You may only set rules on new listings. Updating rules is
										not supported for existing villas in this MVP.
									</div>
								)}
							</div>
						)}

						{wizard.step_index === 4 && (
							<div>
								<h2 className="text-xl font-bold mb-4">Pricing & Details</h2>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="font-semibold" htmlFor="field_nightly_rate">
											Nightly Rate*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={0}
											id="field_nightly_rate"
											value={wizard.price_per_night}
											onChange={(e) =>
												inputChange("price_per_night", Number(e.target.value))
											}
											placeholder="e.g. 320"
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="field_cleaning_fee">
											Cleaning Fee*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={0}
											id="field_cleaning_fee"
											value={wizard.cleaning_fee}
											onChange={(e) => inputChange("cleaning_fee", Number(e.target.value))}
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="field_service_fee">
											Service Fee*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={0}
											id="field_service_fee"
											value={wizard.service_fee}
											onChange={(e) => inputChange("service_fee", Number(e.target.value))}
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="field_taxes">
											Taxes*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={0}
											id="field_taxes"
											value={wizard.taxes}
											onChange={(e) => inputChange("taxes", Number(e.target.value))}
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="field_min_nights">
											Min Nights*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={1}
											max={30}
											id="field_min_nights"
											value={wizard.min_nights}
											onChange={(e) => inputChange("min_nights", Number(e.target.value))}
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="field_max_nights">
											Max Nights*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={wizard.min_nights}
											max={60}
											id="field_max_nights"
											value={wizard.max_nights}
											onChange={(e) => inputChange("max_nights", Number(e.target.value))}
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="field_bedrooms">
											Bedrooms*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={1}
											max={100}
											id="field_bedrooms"
											value={wizard.bedrooms}
											onChange={(e) => inputChange("bedrooms", Number(e.target.value))}
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="field_beds">
											Beds*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={1}
											max={200}
											id="field_beds"
											value={wizard.beds}
											onChange={(e) => inputChange("beds", Number(e.target.value))}
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="field_bathrooms">
											Bathrooms*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={1}
											max={100}
											id="field_bathrooms"
											value={wizard.bathrooms}
											onChange={(e) => inputChange("bathrooms", Number(e.target.value))}
										/>
									</div>
									<div>
										<label className="font-semibold" htmlFor="field_max_guests">
											Max Guests*
										</label>
										<input
											className="input input-bordered w-full"
											type="number"
											min={1}
											max={50}
											id="field_max_guests"
											value={wizard.max_guests}
											onChange={(e) => inputChange("max_guests", Number(e.target.value))}
										/>
									</div>
									<div className="flex flex-col gap-1">
										<label className="font-semibold" htmlFor="field_active">
											Listing Active?
										</label>
										<input
											type="checkbox"
											id="field_active"
											className="mr-2"
											checked={wizard.is_active}
											onChange={() => inputChange("is_active", !wizard.is_active)}
										/>{" "}
										<span className="ml-1">Is Active</span>
									</div>
									<div className="flex flex-col gap-1">
										<label className="font-semibold" htmlFor="field_beachfront">
											Beachfront?
										</label>
										<input
											type="checkbox"
											id="field_beachfront"
											className="mr-2"
											checked={wizard.is_beachfront}
											onChange={() => inputChange("is_beachfront", !wizard.is_beachfront)}
										/>{" "}
										<span className="ml-1">Beachfront</span>
									</div>
									<div className="flex flex-col gap-1">
										<label className="font-semibold" htmlFor="field_pet">
											Pet Friendly?
										</label>
										<input
											type="checkbox"
											id="field_pet"
											className="mr-2"
											checked={wizard.is_pet_friendly}
											onChange={() =>
												inputChange("is_pet_friendly", !wizard.is_pet_friendly)
											}
										/>{" "}
										<span className="ml-1">Pet Friendly</span>
									</div>
									<div className="flex flex-col gap-1">
										<label className="font-semibold" htmlFor="field_instant">
											Instant Book?
										</label>
										<input
											type="checkbox"
											id="field_instant"
											className="mr-2"
											checked={wizard.is_instant_book}
											onChange={() =>
												inputChange("is_instant_book", !wizard.is_instant_book)
											}
										/>{" "}
										<span className="ml-1">Instant Book</span>
									</div>
								</div>
							</div>
						)}

						{wizard.step_index === 5 && (
							<div>
								<h2 className="text-xl font-bold mb-4">Availability Calendar</h2>
								<div className="flex flex-col gap-2">
									<span>
										Toggle days to block (unavailable for guests). Add notes for special
										restrictions.
									</span>
									<div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 bg-gray-50 p-3 max-h-[320px] overflow-auto rounded">
										{wizard.calendar_data.map((d, idx) => {
											const cbId = `calendar_available_${d.date}`;
											const noteId = `calendar_note_${d.date}`;
											return (
												<div
													key={d.date}
													className={`rounded border p-2 flex flex-col bg-white ${d.is_available ? "border-green-600" : "border-red-400 opacity-70"}`}
												>
													<div>
														<label className="font-semibold text-xs" htmlFor={cbId}>
															{d.date}
														</label>
														<input
															type="checkbox"
															id={cbId}
															checked={d.is_available}
															onChange={() => toggleCalendarDay(idx)}
															className="ml-2"
															aria-label={d.is_available ? "Available" : "Blocked"}
														/>
														<span className="text-xs ml-1">
															{d.is_available ? "Open" : "Blocked"}
														</span>
													</div>
													{!d.is_available && (
														<input
															type="text"
															id={noteId}
															className="input input-bordered w-full mt-1"
															value={d.reason || ""}
															placeholder="Block reason"
															onChange={(e) => {
																let arr = wizard.calendar_data.slice();
																arr[idx].reason = e.target.value;
																setWizard((prev) => ({ ...prev, calendar_data: arr }));
															}}
														/>
													)}
												</div>
											);
										})}
									</div>
								</div>
							</div>
						)}

						{wizard.step_index === 6 && (
							<div>
								<h2 className="text-xl font-bold mb-4">Preview & Publish</h2>
								<div className="rounded shadow border bg-gray-50 p-4">
									<h3 className="font-semibold text-lg mb-2">{wizard.title}</h3>
									<div className="flex gap-4 items-start">
										<div>
											{wizard.main_photo_url ? (
												<img
													src={wizard.main_photo_url}
													className="rounded-md w-60 h-40 object-cover shadow"
													alt="Main photo"
												/>
											) : (
												<div className="w-60 h-40 bg-gray-200 rounded flex items-center justify-center text-gray-400">
													No main photo
												</div>
											)}
										</div>
										<div className="flex-1">
											<p className="mb-1">
												<b>
													{wizard.address_street && <>{wizard.address_street}, </>}
													{wizard.address_city}, {wizard.address_country}
												</b>
											</p>
											<div className="mb-1 text-sm">
												Price/Night: <b>${wizard.price_per_night}</b>
											</div>
											<div className="mb-1 text-sm">
												Beds: {wizard.beds} &middot; Baths: {wizard.bathrooms} &middot; Max
												guests: {wizard.max_guests}
											</div>
											<div className="mb-1 text-sm">
												Cancellation:{" "}
												<span className="capitalize">{wizard.cancellation_policy}</span>
											</div>
											<div className="flex flex-wrap gap-1 mt-2">
												{wizard.amenities_options
													.filter((a) => wizard.amenity_ids.includes(a.amenity_id))
													.map((a) => (
														<span
															key={a.amenity_id}
															className="text-xs bg-blue-100 px-2 py-1 rounded"
														>
															{a.label}
														</span>
													))}
											</div>
										</div>
									</div>
									<div className="mt-3 text-base">{wizard.description_short}</div>
									<div className="mt-1 text-sm text-gray-600">
										{wizard.description_long}
									</div>
									<div className="mt-3 text-xs text-gray-700">
										Rules:{" "}
										{wizard.rules.map((r) => (
											<span key={r.rule_type} className="mr-1">
												{r.rule_type.replace(/_/g, " ")}:{" "}
												{r.allowed ? "Allowed" : "Not allowed"}
											</span>
										))}
									</div>
									<div className="mt-2 text-sm">
										<b>Availability (next 2 weeks): </b>
										{wizard.calendar_data.slice(0, 14).map((d) => (
											<span
												key={d.date}
												className={`inline-block rounded px-1 ${d.is_available ? "bg-green-200" : "bg-red-200"}`}
											>
												{d.date.slice(5)} {d.is_available ? "✓" : "×"}
											</span>
										))}
									</div>
								</div>
								{is_edit_mode && (
									<div className="mt-4 text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200 text-sm">
										<div>
											<b>LIMITATION (MVP):</b> You can only edit general info, NOT photos,
											amenities, or rules for an existing villa. To update those, please
											contact support.
										</div>
									</div>
								)}
								<div className="mt-6">
									<button
										className={`btn btn-primary px-6 text-lg ${wizard.loading ? "opacity-60 pointer-events-none" : ""}`}
										onClick={handlePublish}
										disabled={wizard.loading}
										aria-disabled={wizard.loading}
									>
										{is_edit_mode ? "Save changes" : "Publish villa"}
									</button>
									<span className="ml-3">
										<Link
											to="/host/dashboard"
											className="underline text-gray-500 hover:text-blue-700"
										>
											Cancel, return to dashboard
										</Link>
									</span>
								</div>
							</div>
						)}
					</div>

					{/* Step controls */}
					<div className="flex items-center gap-4 justify-between">
						<button
							className={`btn px-4 ${wizard.step_index === 0 ? "btn-disabled opacity-50" : "btn-secondary"}`}
							onClick={prevStep}
							disabled={wizard.step_index === 0}
						>
							Back
						</button>
						<span>
							Step {wizard.step_index + 1} of {TOTAL_STEPS}
						</span>
						{wizard.step_index < TOTAL_STEPS - 1 && (
							<button
								className={`btn px-4 ${isStepValid(wizard.step_index, wizard) ? "btn-primary" : "btn-disabled opacity-50"}`}
								onClick={nextStep}
								disabled={!isStepValid(wizard.step_index, wizard)}
								aria-disabled={!isStepValid(wizard.step_index, wizard)}
							>
								Next
							</button>
						)}
					</div>

					{/* Success/Instruction Box */}
					<div className="mt-7 text-xs text-gray-500 border-t pt-4">
						Fields marked * are required.
						<br />
						{is_edit_mode ? (
							<>
								Listing edit is limited (MVP): <b>photos, amenities and rules</b> cannot
								be updated here. Contact support for advanced editing.
							</>
						) : (
							<>
								Your listing will be published and appear to guests after completing all
								steps and publishing.
								<br />
								<span className="text-blue-600 underline">
									<Link to="/host/dashboard">Back to Host Dashboard</Link>
								</span>
							</>
						)}
					</div>
				</div>
			</>
		);
	} catch (error) {
		console.error("HostOnboardingWizard: Render error:", error);
		return (
			<div className="max-w-3xl mx-auto py-8 px-4">
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
					<h2 className="font-bold">Something went wrong</h2>
					<p>
						There was an error loading the villa onboarding wizard. Please refresh the
						page and try again.
					</p>
					<p className="text-sm mt-2">
						Error: {error instanceof Error ? error.message : "Unknown error"}
					</p>
				</div>
			</div>
		);
	}
};

export default UV_HostOnboardingWizard;
