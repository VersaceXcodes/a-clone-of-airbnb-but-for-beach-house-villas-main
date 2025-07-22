import React, { useState, useEffect } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { useAppStore } from "@/store/main";
import { z } from "zod";

// --- Utility Types ---
type PriceSummary = {
  nightly_price: number;
  cleaning_fee: number;
  service_fee: number;
  taxes: number;
  total_price: number;
};
type GuestDetails = {
  name: string;
  email: string;
  phone: string | null;
  special_requests: string | null;
};
type PaymentForm = {
  card_number: string;
  expiry: string;
  cvv: string;
  agree_tos: boolean;
};
type VillaInfo = {
  villa_id: string;
  title: string;
  address_city: string;
  address_country: string;
  cancellation_policy: string;
  min_nights: number;
  max_nights: number;
  max_guests: number;
  house_rules: string | null;
  main_photo_url?: string | null;
};
// --- Form Validation Helpers ---
function validateDates(checkin: string | null, checkout: string | null): string | null {
  if (!checkin || !checkout) return "Please select both check-in and check-out dates.";
  if (checkin >= checkout) return "Checkout must be after check-in date.";
  return null;
}
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validateCardNumber(card: string): boolean {
  return /^\d{13,19}$/.test(card.replace(/\s/g, ""));
}
function validateExpiry(expiry: string): boolean {
  // MM/YY or MM/YYYY
  return /^((0[1-9])|(1[0-2]))\/(\d{2}|\d{4})$/.test(expiry);
}
function validateCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

// --- Step Constants ---
const TOTAL_STEPS = 5;
const STEP_LABELS = ["Booking Details", "Review & Policy", "Guest Info", "Payment", "Review & Confirm"];

// --- Main Component ---
const UV_BookingStart: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const query = new URLSearchParams(location.search);

  // --- Zustand Store Integration ---
  const user_session = useAppStore((s) => s.user_session);
  const set_booking_cart = useAppStore((s) => s.set_booking_cart);
  const reset_booking_cart = useAppStore((s) => s.reset_booking_cart);

  // --- Read URL State ---
  // Only use the correct case: 'villa_id' (string everywhere)
  const paramVillaId = params.villa_id || query.get("villa_id") || "";
  const villa_id: string = paramVillaId || "";
  
  const prefill_checkin = query.get("checkin_date");
  const prefill_checkout = query.get("checkout_date");
  const prefill_num_guests = Number(query.get("num_guests")) || 1;

  // --- Local Component State (init from store or url) ---
  const [step, setStep] = useState<number>(1);
  const [checkin_date, setCheckinDate] = useState<string | null>(prefill_checkin || null);
  const [checkout_date, setCheckoutDate] = useState<string | null>(prefill_checkout || null);
  const [num_guests, setNumGuests] = useState<number>(prefill_num_guests);
  const [guest_details, setGuestDetails] = useState<GuestDetails>({
    name: user_session.is_authenticated && user_session.display_name ? user_session.display_name : "",
    email: user_session.is_authenticated && user_session.email ? user_session.email : "",
    phone: null,
    special_requests: null,
  });
  const [price_summary, setPriceSummary] = useState<PriceSummary>({
    nightly_price: 0,
    cleaning_fee: 0,
    service_fee: 0,
    taxes: 0,
    total_price: 0,
  });
  const [available, setAvailable] = useState<boolean | null>(null);
  const [payment_form, setPaymentForm] = useState<PaymentForm>({
    card_number: "",
    expiry: "",
    cvv: "",
    agree_tos: false,
  });
  const [status, setStatus] = useState<"idle" | "pending" | "failure" | "success">("idle");
  const [errors, setErrors] = useState<string[]>([]);

  // --- Navigation (router) ---
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Fetch Villa Details (for min/max/house_rules etc) ---
  const {
    data: villaInfo,
    isLoading: isVillaLoading,
    error: villaError,
  } = useQuery<VillaInfo, Error>({
    queryKey: ["villa", villa_id],
    queryFn: async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/villa/${villa_id}`
      );
      return data;
    },
    enabled: !!villa_id,
    staleTime: 60 * 1000,
  });

  // --- Booking Preview (api) ---
  const previewBookingMutation = useMutation({
    mutationFn: async ({
      checkin_date,
      checkout_date,
      num_guests,
    }: {
      checkin_date: string;
      checkout_date: string;
      num_guests: number;
    }) => {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/villas/${villa_id}/booking/preview`,
        { checkin_date, checkout_date, num_guests }
      );
      return data;
    },
    onSuccess: (result) => {
      setAvailable(result.available);
      if (result.price_summary) setPriceSummary(result.price_summary);
      else
        setPriceSummary({
          nightly_price: 0,
          cleaning_fee: 0,
          service_fee: 0,
          taxes: 0,
          total_price: 0,
        });
    },
    onError: (err: any) => {
      setAvailable(false);
      setErrors([(err?.response?.data?.error as string) || "Unable to preview booking."]);
    },
  });

  // --- Booking Confirm/Submit (api) ---
  const submitBookingMutation = useMutation({
    mutationFn: async ({
      checkin_date,
      checkout_date,
      num_guests,
      guest_details,
      token,
    }: {
      checkin_date: string;
      checkout_date: string;
      num_guests: number;
      guest_details: GuestDetails;
      token?: string | null;
    }) => {
      const resp = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/villas/${villa_id}/booking`,
        {
          checkin_date,
          checkout_date,
          num_guests,
          guest_details,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return resp.data;
    },
  });

  // --- Step 1: When fields change, trigger preview ---
  useEffect(() => {
    setErrors([]);
    if (checkin_date && checkout_date && num_guests) {
      // Validate before preview (don't preview if obviously invalid)
      const err = validateDates(checkin_date, checkout_date);
      if (err) {
        setAvailable(false);
        setErrors([err]);
        setPriceSummary({
          nightly_price: 0,
          cleaning_fee: 0,
          service_fee: 0,
          taxes: 0,
          total_price: 0,
        });
        return;
      }
      previewBookingMutation.mutate({ checkin_date, checkout_date, num_guests });
    } else {
      setAvailable(null);
      setPriceSummary({
        nightly_price: 0,
        cleaning_fee: 0,
        service_fee: 0,
        taxes: 0,
        total_price: 0,
      });
    }
    // eslint-disable-next-line
  }, [checkin_date, checkout_date, num_guests, villa_id]);

  // --- Step rules: Back, Next, Confirm, validation ---
  const canProceed = () => {
    switch (step) {
      case 1: {
        // Booking details: dates, guests present and valid, available
        if (!villaInfo) return false;
        if (!checkin_date || !checkout_date || !num_guests) return false;
        if (validateDates(checkin_date, checkout_date)) return false;
        if (!available) return false;
        if (
          num_guests < 1 ||
          num_guests > villaInfo.max_guests ||
          !villaInfo ||
          !available
        )
          return false;
        return true;
      }
      case 2: {
        // Review & policies; must have valid preview (step1 must pass)
        if (!canProceedToStep(1)) return false;
        return true;
      }
      case 3: {
        // Guest info
        if (!guest_details.name || guest_details.name.trim().length < 1) return false;
        if (!guest_details.email || !validateEmail(guest_details.email)) return false;
        // No further validation for phone/special_requests
        return true;
      }
      case 4: {
        // Payment mock
        if (!validateCardNumber(payment_form.card_number)) return false;
        if (!validateExpiry(payment_form.expiry)) return false;
        if (!validateCVV(payment_form.cvv)) return false;
        if (!payment_form.agree_tos) return false;
        return true;
      }
      case 5: {
        // Final Review: everything must be valid; step4 must be okay
        if (
          !canProceedToStep(1) ||
          !canProceedToStep(2) ||
          !canProceedToStep(3) ||
          !canProceedToStep(4)
        )
          return false;
        return true;
      }
      default:
        return false;
    }
  };

  // Used to ensure all previous steps are valid (for review step)
  const canProceedToStep = (s: number) => {
    if (s >= step) return true;
    switch (s) {
      case 1:
        return (
          checkin_date &&
          checkout_date &&
          !validateDates(checkin_date, checkout_date) &&
          available &&
          num_guests >= 1 &&
          !!villaInfo &&
          num_guests <= villaInfo.max_guests
        );
      case 2:
        return canProceedToStep(1);
      case 3:
        return (
          guest_details.name.trim().length > 0 &&
          !!guest_details.email &&
          validateEmail(guest_details.email)
        );
      case 4:
        return (
          validateCardNumber(payment_form.card_number) &&
          validateExpiry(payment_form.expiry) &&
          validateCVV(payment_form.cvv) &&
          payment_form.agree_tos
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    setErrors([]);
    if (canProceed()) setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    else setErrors(["Please complete all required fields before proceeding."]);
  };

  const handleBack = () => {
    setErrors([]);
    setStep((s) => Math.max(s - 1, 1));
  };

  const handlePreviewEdit = (field: string) => {
    setStep(field === "details" ? 1 : field === "guest" ? 3 : 4);
  };

  // --- Auth gating: must be logged in for steps 3+ ---
  useEffect(() => {
    if (
      step >= 3 &&
      (!user_session.is_authenticated || !user_session.token || !user_session.user_id)
    ) {
      // Save flow state, redirect to login
      set_booking_cart({
        villa_id,
        checkin_date,
        checkout_date,
        num_guests,
        guest_details,
        price_summary,
        status: "idle",
      });
      navigate("/guest/login", { state: { next: location.pathname + location.search } });
    }
    // eslint-disable-next-line
  }, [step, user_session.is_authenticated, user_session.token, user_session.user_id]);

  useEffect(() => {
    // Reset all booking cart on component mount/unmount
    reset_booking_cart();
    // Prefill with known info
    set_booking_cart({
      villa_id,
      checkin_date,
      checkout_date,
      num_guests,
    });
    // eslint-disable-next-line
  }, []);

  // Final step: on confirm
  const handleSubmit = async () => {
    setStatus("pending");
    setErrors([]);
    try {
      const data = await submitBookingMutation.mutateAsync({
        checkin_date: checkin_date!,
        checkout_date: checkout_date!,
        num_guests,
        guest_details,
        token: user_session.token,
      });
      setStatus("success");
      set_booking_cart({
        villa_id,
        checkin_date,
        checkout_date,
        num_guests,
        guest_details,
        price_summary,
        status: "success",
      });
      // Invalidate bookings/trips after booking
      queryClient.invalidateQueries({ queryKey: ["my_trips"] });
      // Redirect to confirmation with booking_id
      navigate(`/booking/confirmation/${data.booking_id}`);
    } catch (err: any) {
      setStatus("failure");
      const message = (err?.response?.data?.error as string) || "Booking could not be completed. Please try again.";
      setErrors([message]);
      navigate(`/booking/failure?reason=${encodeURIComponent(message)}`);
    }
  };

  // UI: Step progress bar
  const renderProgress = (
    <div className="w-full flex items-center my-6">
      {STEP_LABELS.map((label, idx) => (
        <div key={label} className="flex-1 flex items-center">
          <div
            className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full 
            ${
              step > idx
                ? "bg-green-500 text-white"
                : step === idx + 1
                ? "bg-sky-600 text-white font-bold"
                : "bg-gray-300 text-gray-600"
            }
            `}
          >
            {idx + 1}
          </div>
          {idx < STEP_LABELS.length - 1 && (
            <div className={`flex-1 h-1 ${step > idx + 1 ? "bg-green-500" : "bg-gray-200"}`}></div>
          )}
        </div>
      ))}
    </div>
  );

  // UI: Error/Fallback boundary
  const renderErrors = !!errors.length && (
    <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-2 rounded my-3">
      {errors.map((err) => (
        <div key={err}>{err}</div>
      ))}
    </div>
  );

  // --- Step 1: Booking Details (Dates, Guests) ---
  const step1 = (
    <div className="space-y-6">
      <div className="text-2xl font-semibold text-gray-900">Select Dates and Guests</div>
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="checkin">
            Check-in Date
          </label>
          <input
            type="date"
            id="checkin"
            value={checkin_date || ""}
            min={new Date().toISOString().slice(0, 10)}
            max={checkout_date || ""}
            disabled={isVillaLoading}
            className="border rounded px-3 py-2 w-44"
            onChange={(e) => setCheckinDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="checkout">
            Check-out Date
          </label>
          <input
            type="date"
            id="checkout"
            value={checkout_date || ""}
            min={checkin_date || new Date().toISOString().slice(0, 10)}
            disabled={isVillaLoading}
            className="border rounded px-3 py-2 w-44"
            onChange={(e) => setCheckoutDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="guests">
            Guests
          </label>
          <input
            type="number"
            id="guests"
            min={1}
            max={villaInfo?.max_guests || 20}
            value={num_guests}
            step={1}
            disabled={isVillaLoading}
            className="border rounded px-3 py-2 w-24"
            onChange={(e) => setNumGuests(Math.max(1, Math.min(Number(e.target.value), villaInfo?.max_guests || 20)))}
          />
        </div>
      </div>
      <div>
        {available != null &&
          (available ? (
            <div className="text-green-600 flex items-center gap-2">
              <span className="font-bold">&#10004; Dates available!</span>
              <span>
                {price_summary.total_price > 0 &&
                  `Total: $${price_summary.total_price.toFixed(2)}`}
              </span>
            </div>
          ) : (
            <div className="text-red-600 flex items-center gap-2">
              <span className="font-bold">&#9888; Not available for selected dates</span>
            </div>
          ))}
      </div>
      {renderErrors}
      <div className="flex gap-4 mt-6">
        <button
          onClick={handleNext}
          className={`bg-sky-600 text-white px-6 py-2 rounded font-bold ${
            !canProceed() ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={!canProceed()}
        >
          Next
        </button>
        <Link
          to={`/villa/${villa_id}`}
          className="text-gray-500 underline hover:text-gray-700 transition"
        >
          Cancel and return to villa
        </Link>
      </div>
    </div>
  );

  // --- Step 2: Policies and Review ---
  const step2 = (
    <div className="space-y-6">
      <div className="text-2xl font-semibold text-gray-900 mb-2">
        Review Your Booking
      </div>
      <div className="rounded border border-gray-200 p-4 bg-gray-50 space-y-2">
        <div className="flex gap-6 items-center">
          {villaInfo?.main_photo_url && (
            <img
              src={villaInfo.main_photo_url}
              alt={villaInfo.title}
              className="w-28 h-20 object-cover rounded"
            />
          )}
          <div>
            <div className="text-lg font-semibold">{villaInfo?.title}</div>
            <div className="text-gray-600">{villaInfo?.address_city}, {villaInfo?.address_country}</div>
          </div>
        </div>
        <div className="mt-4 text-gray-700">
          <strong>Dates:</strong> {checkin_date} &ndash; {checkout_date}
        </div>
        <div className="text-gray-700">
          <strong>Guests:</strong> {num_guests}
        </div>
      </div>
      <div className="rounded border border-gray-200 p-4 bg-gray-50">
        <div className="text-lg font-bold mb-2">Price Breakdown</div>
        <ul className="space-y-1 text-gray-700">
          <li>
            <span>Nightly Rate:</span>{" "}
            <span>${price_summary.nightly_price.toFixed(2)}</span>
          </li>
          <li>
            <span>Cleaning Fee:</span>{" "}
            <span>${price_summary.cleaning_fee.toFixed(2)}</span>
          </li>
          <li>
            <span>Service Fee:</span>{" "}
            <span>${price_summary.service_fee.toFixed(2)}</span>
          </li>
          <li>
            <span>Taxes:</span> <span>${price_summary.taxes.toFixed(2)}</span>
          </li>
          <li className="font-bold">
            <span>Total:</span> <span>${price_summary.total_price.toFixed(2)}</span>
          </li>
        </ul>
      </div>
      <div className="rounded border border-gray-100 p-4 bg-gray-50">
        <div className="font-bold text-gray-900 mb-1">Cancellation Policy</div>
        <div className="text-gray-700">
          {villaInfo?.cancellation_policy
            ? (villaInfo.cancellation_policy.charAt(0).toUpperCase() +
              villaInfo.cancellation_policy.slice(1))
            : "Not specified"}
        </div>
        {villaInfo?.house_rules && (
          <>
            <div className="font-bold text-gray-900 mt-2 mb-1">House Rules</div>
            <div className="text-gray-700 whitespace-pre-line">{villaInfo.house_rules}</div>
          </>
        )}
      </div>
      {renderErrors}
      <div className="flex gap-4 mt-6">
        <button
          type="button"
          onClick={handleBack}
          className="bg-gray-100 text-gray-800 px-6 py-2 rounded"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className={`bg-sky-600 text-white px-6 py-2 rounded font-bold ${
            !canProceed() ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={!canProceed()}
        >
          Next
        </button>
      </div>
    </div>
  );

  // --- Step 3: Guest Details ---
  const step3 = (
    <div className="space-y-6">
      <div className="text-2xl font-semibold text-gray-900">Lead Guest Details</div>
      <div>
        <label className="block text-gray-700 font-medium mb-1" htmlFor="guest_name">
          Name <span className="text-red-600">*</span>
        </label>
        <input
          id="guest_name"
          type="text"
          className="border px-3 py-2 rounded w-full max-w-md"
          value={guest_details.name}
          onChange={(e) =>
            setGuestDetails((v) => ({ ...v, name: e.target.value }))
          }
        />
      </div>
      <div>
        <label className="block text-gray-700 font-medium mb-1" htmlFor="guest_email">
          Email <span className="text-red-600">*</span>
        </label>
        <input
          id="guest_email"
          type="email"
          autoComplete="email"
          className="border px-3 py-2 rounded w-full max-w-md"
          value={guest_details.email}
          onChange={(e) =>
            setGuestDetails((v) => ({ ...v, email: e.target.value.trim() }))
          }
        />
      </div>
      <div>
        <label className="block text-gray-700 font-medium mb-1" htmlFor="guest_phone">
          Phone (optional)
        </label>
        <input
          id="guest_phone"
          type="tel"
          className="border px-3 py-2 rounded w-full max-w-md"
          value={guest_details.phone || ""}
          onChange={(e) =>
            setGuestDetails((v) => ({ ...v, phone: e.target.value.trim() || null }))
          }
        />
      </div>
      <div>
        <label className="block text-gray-700 font-medium mb-1" htmlFor="guest_special">
          Special Requests (optional)
        </label>
        <textarea
          id="guest_special"
          className="border px-3 py-2 rounded w-full max-w-md resize-none min-h-[40px]"
          value={guest_details.special_requests || ""}
          maxLength={250}
          onChange={(e) =>
            setGuestDetails((v) => ({
              ...v,
              special_requests: e.target.value || null,
            }))
          }
        ></textarea>
      </div>
      {renderErrors}
      <div className="flex gap-4 mt-6">
        <button
          type="button"
          onClick={handleBack}
          className="bg-gray-100 text-gray-800 px-6 py-2 rounded"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className={`bg-sky-600 text-white px-6 py-2 rounded font-bold ${
            !canProceed() ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={!canProceed()}
        >
          Next
        </button>
      </div>
    </div>
  );

  // --- Step 4: Payment (mock) ---
  const step4 = (
    <div className="space-y-6">
      <div className="text-2xl font-semibold text-gray-900">Payment Details</div>
      <div className="mb-2 text-gray-600">All payments are simulated for MVP.</div>
      <div>
        <label className="block text-gray-700 font-medium mb-1" htmlFor="pay_card">
          Card Number <span className="text-red-600">*</span>
        </label>
        <input
          id="pay_card"
          autoComplete="cc-number"
          type="text"
          maxLength={19}
          className="border px-3 py-2 rounded w-full max-w-sm"
          value={payment_form.card_number}
          onChange={(e) =>
            setPaymentForm((v) => ({
              ...v,
              card_number: e.target.value.replace(/[^\d]/g, ""),
            }))
          }
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-gray-700 font-medium mb-1" htmlFor="pay_expiry">
            Expiry (MM/YY) <span className="text-red-600">*</span>
          </label>
          <input
            id="pay_expiry"
            type="text"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            maxLength={7}
            className="border px-3 py-2 rounded w-28"
            value={payment_form.expiry}
            onChange={(e) =>
              setPaymentForm((v) => ({ ...v, expiry: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-1" htmlFor="pay_cvv">
            CVV <span className="text-red-600">*</span>
          </label>
          <input
            id="pay_cvv"
            autoComplete="cc-csc"
            type="text"
            maxLength={4}
            className="border px-3 py-2 rounded w-20"
            value={payment_form.cvv}
            onChange={(e) =>
              setPaymentForm((v) => ({
                ...v,
                cvv: e.target.value.replace(/[^\d]/g, ""),
              }))
            }
          />
        </div>
      </div>
      <div className="flex items-center mt-2">
        <input
          id="agree_tos"
          type="checkbox"
          className="mr-2"
          checked={payment_form.agree_tos}
          onChange={(e) =>
            setPaymentForm((v) => ({ ...v, agree_tos: e.target.checked }))
          }
        />
        <label htmlFor="agree_tos" className="text-gray-700 cursor-pointer">
          I agree to the{" "}
          <Link
            className="underline text-sky-700"
            to="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Service
          </Link>
          .
        </label>
      </div>
      {renderErrors}
      <div className="flex gap-4 mt-6">
        <button
          type="button"
          onClick={handleBack}
          className="bg-gray-100 text-gray-800 px-6 py-2 rounded"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className={`bg-sky-600 text-white px-6 py-2 rounded font-bold ${
            !canProceed() ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={!canProceed()}
        >
          Next
        </button>
      </div>
    </div>
  );

  // --- Step 5: Final Confirm ---
  const step5 = (
    <div className="space-y-6">
      <div className="text-2xl font-semibold text-gray-900 mb-3">Review & Confirm</div>
      <div className="rounded border border-gray-200 p-4 bg-gray-50 space-y-2">
        <div className="flex items-center gap-6">
          {villaInfo?.main_photo_url && (
            <img
              src={villaInfo.main_photo_url}
              alt={villaInfo.title}
              className="w-32 h-20 rounded object-cover"
            />
          )}
          <div>
            <div className="font-bold text-lg">{villaInfo?.title}</div>
            <div className="text-gray-700">{villaInfo?.address_city}, {villaInfo?.address_country}</div>
          </div>
        </div>
        <div className="flex space-x-4 flex-wrap">
          <div className="text-gray-700">
            <strong>Dates:</strong> {checkin_date} &ndash; {checkout_date}
          </div>
          <div className="text-gray-700">
            <strong>Guests:</strong> {num_guests}
          </div>
        </div>
        <div className="mt-2 text-gray-700">
          <strong>Contact:</strong> {guest_details.name} ({guest_details.email}
          {guest_details.phone ? `, ${guest_details.phone}` : ""})
        </div>
        {guest_details.special_requests && (
          <div className="text-gray-700">
            <strong>Special Requests:</strong> {guest_details.special_requests}
          </div>
        )}
      </div>
      <div className="rounded border border-gray-200 p-4 bg-gray-50 space-y-1">
        <div className="text-lg font-bold mb-1">Price Breakdown</div>
        <ul>
          <li>
            Nightly Rate: ${price_summary.nightly_price.toFixed(2)}
          </li>
          <li>
            Cleaning Fee: ${price_summary.cleaning_fee.toFixed(2)}
          </li>
          <li>
            Service Fee: ${price_summary.service_fee.toFixed(2)}
          </li>
          <li>
            Taxes: ${price_summary.taxes.toFixed(2)}
          </li>
          <li className="font-bold">
            Total: ${price_summary.total_price.toFixed(2)}
          </li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          className="text-sky-700 underline"
          onClick={() => handlePreviewEdit("details")}
        >
          Edit Dates/Guests
        </button>
        <button
          type="button"
          className="text-sky-700 underline"
          onClick={() => handlePreviewEdit("guest")}
        >
          Edit Guest Info
        </button>
        <button
          type="button"
          className="text-sky-700 underline"
          onClick={() => handlePreviewEdit("payment")}
        >
          Edit Payment
        </button>
      </div>
      {renderErrors}
      <div className="flex gap-4 mt-7">
        <button
          type="button"
          onClick={handleBack}
          className="bg-gray-100 text-gray-800 px-6 py-2 rounded"
        >
          Back
        </button>
        <button
          type="button"
          className={`bg-green-600 text-white px-7 py-2 rounded font-bold ${
            status === "pending" || !canProceed() ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={status === "pending" || !canProceed()}
          onClick={handleSubmit}
        >
          {status === "pending" ? "Processing..." : "Confirm & Pay"}
        </button>
      </div>
      <div className="mt-2">
        <Link
          to={`/villa/${villa_id}`}
          className="text-gray-700 underline"
        >
          Cancel and return to villa details
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <div className="max-w-2xl mx-auto my-8 bg-white border border-gray-200 shadow-lg rounded-lg px-8 py-8">
        <div aria-label="Booking Steps Progress">{renderProgress}</div>
        {/* Loading/Error for villa info */}
        {isVillaLoading && (
          <div className="text-center py-12 text-lg text-gray-500">
            Loading booking info...
          </div>
        )}
        {villaError && (
          <div className="text-center text-red-600 py-10">
            Could not load villa info. <Link className="underline" to="/">Return to home</Link>
          </div>
        )}
        {!isVillaLoading && !villaError && (
          <>
            {step === 1 && step1}
            {step === 2 && step2}
            {step === 3 && step3}
            {step === 4 && step4}
            {step === 5 && step5}
          </>
        )}
      </div>
    </>
  );
};

export default UV_BookingStart;