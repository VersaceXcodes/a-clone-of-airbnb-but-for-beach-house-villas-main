import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import qs from "qs";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAppStore } from "@/store/main";
import { z } from "zod";

// --- Types from shared schema ---
type VillaSummary = {
  villa_id: string;
  title: string;
  address_city: string;
  main_photo_url: string;
  price_per_night: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  is_active: boolean;
  is_instant_book: boolean;
  avg_rating: number;
  reviews_count: number;
};
type Amenity = {
  amenity_id: number;
  label: string;
  icon_url: string | null;
  created_at?: Date | string;
};
type SearchFilters = {
  price_min: number | null;
  price_max: number | null;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: number | null;
  amenities: number[];
  is_beachfront: boolean | null;
  is_pet_friendly: boolean | null;
  is_instant_book: boolean | null;
};

// --- Helper: Parse and Coerce Search Params ---
const parseSearchParams = (search: string): {
  location: string;
  checkin_date: string | null;
  checkout_date: string | null;
  num_guests: number;
  filters: SearchFilters;
  sort: string;
  page: number;
} => {
  const params = qs.parse(search.startsWith("?") ? search.slice(1) : search, {
    ignoreQueryPrefix: true,
    decoder: (str, defaultDecoder, charset, type) => {
      if (type === 'value') {
        if (str === 'null') return null;
        if (str === 'true') return true;
        if (str === 'false') return false;
        // For numeric strings that parse as integers or floats
        if (/^-?\d+(\.\d+)?$/.test(str)) {
          const n = Number(str);
          return Number.isNaN(n) ? str : n;
        }
      }
      return defaultDecoder(str, defaultDecoder, charset);
    }
  });

  // Arrayify amenities from comma-format
  let amenities: number[] = [];
  let amenities_param = params.amenities;
  if (typeof amenities_param === "string") {
    amenities = amenities_param.split(",").filter(Boolean).map(a => Number(a)).filter(Number.isFinite);
  } else if (Array.isArray(amenities_param)) {
    amenities = amenities_param.flatMap((a) =>
      (typeof a === "string")
        ? a.split(",").map(x => Number(x)).filter(Number.isFinite)
        : []
    );
  }

  // Ensure booleans or nulls per query param
  const coerceBool = (v: any) => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === true) return true;
    if (v === 'false' || v === false) return false;
    return null;
  };

  // Compose filters
  const filters: SearchFilters = {
    price_min: params.price_min !== undefined ? Number(params.price_min) : null,
    price_max: params.price_max !== undefined ? Number(params.price_max) : null,
    bedrooms: params.bedrooms !== undefined ? Number(params.bedrooms) : null,
    beds: params.beds !== undefined ? Number(params.beds) : null,
    bathrooms: params.bathrooms !== undefined ? Number(params.bathrooms) : null,
    amenities: amenities,
    is_beachfront: coerceBool(params.is_beachfront),
    is_pet_friendly: coerceBool(params.is_pet_friendly),
    is_instant_book: coerceBool(params.is_instant_book),
  };

  return {
    location: (params.location || "") as string,
    checkin_date: params.checkin_date ? String(params.checkin_date) : null,
    checkout_date: params.checkout_date ? String(params.checkout_date) : null,
    num_guests: params.num_guests ? Number(params.num_guests) : 1,
    filters,
    sort: params.sort ? String(params.sort) : "recommended",
    page: params.page ? Number(params.page) : 1,
  };
};

const defaultFilters: SearchFilters = {
  price_min: null,
  price_max: null,
  bedrooms: null,
  beds: null,
  bathrooms: null,
  amenities: [],
  is_beachfront: null,
  is_pet_friendly: null,
  is_instant_book: null,
};

const sortOptions: { key: string; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "price_low_high", label: "Price (Low → High)" },
  { key: "price_high_low", label: "Price (High → Low)" },
  { key: "rating", label: "User Rating" },
  { key: "newest", label: "Newest" },
  { key: "popularity", label: "Most Popular" },
];

// Filter: Attach to param string
function buildSearchQueryString(state: {
  location: string;
  checkin_date: string | null;
  checkout_date: string | null;
  num_guests: number;
  filters: SearchFilters;
  sort: string;
  page: number;
}): string {
  const query: any = {};
  if (state.location) query.location = state.location;
  if (state.checkin_date) query.checkin_date = state.checkin_date;
  if (state.checkout_date) query.checkout_date = state.checkout_date;
  if (state.num_guests) query.num_guests = state.num_guests;
  if (state.filters.price_min !== null) query.price_min = state.filters.price_min;
  if (state.filters.price_max !== null) query.price_max = state.filters.price_max;
  if (state.filters.bedrooms !== null) query.bedrooms = state.filters.bedrooms;
  if (state.filters.beds !== null) query.beds = state.filters.beds;
  if (state.filters.bathrooms !== null) query.bathrooms = state.filters.bathrooms;
  if (state.filters.amenities?.length)
    query.amenities = state.filters.amenities.join(",");
  if (state.filters.is_beachfront !== null) query.is_beachfront = state.filters.is_beachfront === true ? "true" : state.filters.is_beachfront === false ? "false" : undefined;
  if (state.filters.is_pet_friendly !== null) query.is_pet_friendly = state.filters.is_pet_friendly === true ? "true" : state.filters.is_pet_friendly === false ? "false" : undefined;
  if (state.filters.is_instant_book !== null) query.is_instant_book = state.filters.is_instant_book === true ? "true" : state.filters.is_instant_book === false ? "false" : undefined;
  if (state.sort) query.sort = state.sort;
  if (state.page) query.page = state.page;

  return qs.stringify(query, { addQueryPrefix: true, arrayFormat: "comma" });
}

const VILLAS_PAGE_SIZE = 12; // Note: Fixed on server (see backend) but for pagination display

const UV_SearchResults: React.FC = () => {
  // URL, navigation, and store state hooks
  const { search } = useLocation();
  const navigate = useNavigate();
  // - Zustand global state wiring
  const search_state = useAppStore(s => s.search_state);
  const set_search_state = useAppStore(s => s.set_search_state);

  // Local state for map toggle
  const [map_open, set_map_open] = useState<boolean>(false);

  // --- Amenities master list ---
  const {
    data: amenitiesOptions,
    isLoading: isAmenitiesLoading,
    isError: isAmenitiesError,
  } = useQuery<Amenity[]>({
    queryKey: ["amenities"],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const { data } = await axios.get(`${baseUrl}/villas/amenities`);
      return data;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });

  // --- Hydrate state from URL params on mount & URL change ---
  // (Also rehydrate search_state in Zustand)
  useEffect(() => {
    const parsed = parseSearchParams(search);
    set_search_state(parsed);
    // eslint-disable-next-line
  }, [search]);

  // --- Memoized view-state for queryKey ---
  const queryFilters = useMemo(() => {
    return {
      location: search_state.location,
      checkin_date: search_state.checkin_date,
      checkout_date: search_state.checkout_date,
      num_guests: search_state.num_guests,
      ...search_state.filters,
      sort: search_state.sort,
      page: search_state.page,
    };
    // eslint-disable-next-line
  }, [search_state]);

  // --- Fetch villas based on params ---
  const {
    data: villasData,
    isLoading: isVillasLoading,
    isError: isVillasError,
    error: villasError,
    refetch,
  } = useQuery<{
    results: VillaSummary[];
    total: number;
    page: number;
  }, Error>({
    queryKey: [
      "villas",
      queryFilters.location,
      queryFilters.checkin_date,
      queryFilters.checkout_date,
      queryFilters.num_guests,
      queryFilters.price_min,
      queryFilters.price_max,
      queryFilters.bedrooms,
      queryFilters.beds,
      queryFilters.bathrooms,
      (queryFilters.amenities || []).join(","),
      queryFilters.is_beachfront,
      queryFilters.is_pet_friendly,
      queryFilters.is_instant_book,
      queryFilters.sort,
      queryFilters.page,
    ],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const paramsObj: any = {};

      if (queryFilters.location) paramsObj.location = queryFilters.location;
      if (queryFilters.checkin_date) paramsObj.checkin_date = queryFilters.checkin_date;
      if (queryFilters.checkout_date) paramsObj.checkout_date = queryFilters.checkout_date;
      if (queryFilters.num_guests) paramsObj.num_guests = queryFilters.num_guests;
      if (queryFilters.price_min != null) paramsObj.price_min = queryFilters.price_min;
      if (queryFilters.price_max != null) paramsObj.price_max = queryFilters.price_max;
      if (queryFilters.bedrooms != null) paramsObj.bedrooms = queryFilters.bedrooms;
      if (queryFilters.beds != null) paramsObj.beds = queryFilters.beds;
      if (queryFilters.bathrooms != null) paramsObj.bathrooms = queryFilters.bathrooms;
      if (queryFilters.amenities && queryFilters.amenities.length)
        paramsObj.amenities = queryFilters.amenities.join(",");
      if (queryFilters.is_beachfront !== null) paramsObj.is_beachfront = queryFilters.is_beachfront === true ? "true" : queryFilters.is_beachfront === false ? "false" : undefined;
      if (queryFilters.is_pet_friendly !== null) paramsObj.is_pet_friendly = queryFilters.is_pet_friendly === true ? "true" : queryFilters.is_pet_friendly === false ? "false" : undefined;
      if (queryFilters.is_instant_book !== null) paramsObj.is_instant_book = queryFilters.is_instant_book === true ? "true" : queryFilters.is_instant_book === false ? "false" : undefined;
      if (queryFilters.sort) paramsObj.sort = queryFilters.sort;
      if (queryFilters.page) paramsObj.page = queryFilters.page;

      const { data } = await axios.get(
        `${baseUrl}/villas`,
        {
          params: paramsObj,
          paramsSerializer: (params) =>
            qs.stringify(params, { arrayFormat: "comma" }),
        }
      );
      // Patch villa_id + image fallback
      return {
        results: (data.results || []).map((v: any) => ({
          ...v,
          villa_id: String(v.villa_id),
          main_photo_url:
            v.main_photo_url ||
            `https://picsum.photos/seed/villa_${v.villa_id}/600/400`,
        })),
        total: data.total,
        page: data.page,
      };
    },
    keepPreviousData: true,
    retry: 2,
  });

  // --- Handler: Update a filter value and navigate (updates URL and triggers reload) ---
  // filterKey = "filters.price_min" or "filters.amenities", use lodash-like path
  const updateFilter = (
    key: keyof SearchFilters,
    value: number | boolean | number[] | null
  ) => {
    const newFilters: SearchFilters = { ...(search_state.filters || defaultFilters) };
    (newFilters as any)[key] = value;
    const newURLState = {
      ...search_state,
      filters: newFilters,
      page: 1, // reset page on filter change
    };
    const queryString = buildSearchQueryString(newURLState);
    navigate(`/search${queryString}`);
  };

  // --- Handler: sort change ---
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value;
    const newURLState = {
      ...search_state,
      sort: newSort,
      page: 1, // reset page on sort change
    };
    const queryString = buildSearchQueryString(newURLState);
    navigate(`/search${queryString}`);
  };

  // --- Handler: Pagination ---
  const goToPage = (page: number) => {
    if (page < 1) return;
    const newState = { ...search_state, page };
    const queryString = buildSearchQueryString(newState);
    navigate(`/search${queryString}`);
  };

  // --- Handler: Amenities multi-select ---
  const handleAmenitiesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(
      e.target.selectedOptions
    ).map((opt) => Number(opt.value));
    updateFilter("amenities", selected);
  };

  // --- Handler: map toggle ---
  const handleToggleMap = () => {
    set_map_open((prev) => !prev);
  };

  // --- Handler: Numeric filter input change ---
  const handleNumericFilterChange = (
    key: keyof SearchFilters,
    value: string
  ) => {
    let n = value === "" ? null : Number(value);
    if (n !== null && Number.isNaN(n)) n = null;
    updateFilter(key, n);
  };

  // --- Handler: Boolean filter (checkboxes) ---
  const handleBooleanFilterChange = (key: keyof SearchFilters, value: boolean) => {
    updateFilter(key, value ? true : null); // Uncheck → null (clears filter)
  };

  // --- For location, checkin/checkout, guests, just show as read-only in bar (as they're complex/tied to nav) ---

  // --- Compute Pagination Details ---
  const totalResults = villasData?.total || 0;
  const page = villasData?.page || 1;
  const villas = villasData?.results || [];
  const pageQty = Math.max(1, Math.ceil(totalResults / VILLAS_PAGE_SIZE));
  const resStart = (page - 1) * VILLAS_PAGE_SIZE + 1;
  const resEnd = Math.min(page * VILLAS_PAGE_SIZE, totalResults);

  // --- Empty state suggestion logic ---
  const suggestedLocations = ["Malibu", "Santa Monica", "Cancun", "Maui", "Tulum"];
  const altLocation =
    suggestedLocations.find((loc) => loc !== search_state.location) ||
    "Miami Beach";

  // --- Error Boundary UI Section ---
  const [fetchError, setFetchError] = useState<string | null>(null);
  useEffect(() => {
    if (isVillasError) {
      setFetchError(villasError ? villasError.message : "Unknown error loading villas.");
    } else {
      setFetchError(null);
    }
  }, [isVillasError, villasError]);

  return (
    <>
      <div className="w-full max-w-7xl mx-auto py-2 px-2 md:px-6">
        {/* Header: Filters, Sorting, Map toggle */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-y-2 border-b pb-4 mb-6">
          {/* Read-only search summary: location, date, guests */}
          <div className="flex flex-col gap-y-1 md:flex-row md:gap-x-6 md:items-center">
            {/* Location */}
            <span className="text-lg font-semibold text-primary">
              {search_state.location
                ? search_state.location
                : "All Destinations"}
            </span>
            {/* Dates */}
            <span className="text-sm text-gray-600">
              {search_state.checkin_date && search_state.checkout_date
                ? `${search_state.checkin_date} to ${search_state.checkout_date}`
                : "Any Dates"}
            </span>
            {/* Guests */}
            <span className="text-sm text-gray-600">
              {search_state.num_guests
                ? `${search_state.num_guests} guest${search_state.num_guests > 1 ? "s" : ""}`
                : ""}
            </span>
          </div>

          {/* Map toggle */}
          <button
            type="button"
            className="ml-auto md:ml-0 rounded-lg px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium flex items-center space-x-2 transition"
            onClick={handleToggleMap}
            aria-pressed={map_open}
            title={map_open ? "Hide Map" : "Show Map"}
          >
            <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A2 2 0 013 15.382V5.618a2 2 0 012.553-1.894L9 6.618l6-3 5.447 2.724A2 2 0 0121 8.618v9.764a2 2 0 01-2.553 1.894L15 17.382l-6 3z" />
            </svg>
            <span>{map_open ? "Hide Map" : "Show Map"}</span>
          </button>
        </div>

        {/* Filter & Sort Bar */}
        <div className="flex flex-col md:flex-row md:items-end gap-2 border-b pb-4 mb-4">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* Price Range */}
            <label className="flex items-center text-sm">
              <span className="text-gray-600 mr-1">From&nbsp;</span>
              <input
                className="w-20 px-2 rounded border border-gray-300 text-sm"
                type="number"
                min={0}
                placeholder="Min $"
                value={search_state.filters.price_min ?? ""}
                onChange={e =>
                  handleNumericFilterChange("price_min", e.target.value)
                }
              />
              <span className="mx-0.5">–</span>
              <input
                className="w-20 px-2 rounded border border-gray-300 text-sm"
                type="number"
                min={0}
                placeholder="Max $"
                value={search_state.filters.price_max ?? ""}
                onChange={e =>
                  handleNumericFilterChange("price_max", e.target.value)
                }
              />
            </label>
            {/* Bedrooms */}
            <label className="flex items-center text-sm">
              <span className="mr-1 text-gray-600">Bedrooms</span>
              <input
                className="w-12 px-2 rounded border border-gray-300 text-sm"
                type="number"
                min={0}
                max={16}
                value={search_state.filters.bedrooms ?? ""}
                onChange={e =>
                  handleNumericFilterChange("bedrooms", e.target.value)
                }
              />
            </label>
            {/* Beds */}
            <label className="flex items-center text-sm">
              <span className="mr-1 text-gray-600">Beds</span>
              <input
                className="w-12 px-2 rounded border border-gray-300 text-sm"
                type="number"
                min={0}
                max={30}
                value={search_state.filters.beds ?? ""}
                onChange={e =>
                  handleNumericFilterChange("beds", e.target.value)
                }
              />
            </label>
            {/* Bathrooms */}
            <label className="flex items-center text-sm">
              <span className="mr-1 text-gray-600">Baths</span>
              <input
                className="w-12 px-2 rounded border border-gray-300 text-sm"
                type="number"
                min={0}
                max={30}
                value={search_state.filters.bathrooms ?? ""}
                onChange={e =>
                  handleNumericFilterChange("bathrooms", e.target.value)
                }
              />
            </label>
            {/* Amenity Multi-select */}
            <div>
              <select
                className="min-w-[120px] px-2 py-1 border border-gray-300 rounded text-sm"
                multiple
                value={search_state.filters.amenities.map(String)}
                onChange={handleAmenitiesChange}
                size={isAmenitiesLoading ? 1 : 3}
                aria-label="Amenities Filter"
              >
                <option value="" disabled>
                  {isAmenitiesLoading ? "Loading..." : "Select amenities"}
                </option>
                {!!amenitiesOptions && amenitiesOptions.length > 0 &&
                  amenitiesOptions.map(a => (
                    <option
                      value={String(a.amenity_id)}
                      key={a.amenity_id}
                      className="capitalize"
                    >
                      {a.label}
                    </option>
                  ))}
              </select>{" "}
              <span className="ml-1 text-xs text-gray-500">Amenities</span>
            </div>
            {/* Flags */}
            <label className="flex items-center text-xs ml-1 mt-1">
              <input
                type="checkbox"
                className="mr-1 accent-blue-500"
                checked={!!search_state.filters.is_beachfront}
                onChange={e =>
                  handleBooleanFilterChange("is_beachfront", e.target.checked)
                }
              />
              Beachfront
            </label>
            <label className="flex items-center text-xs ml-1 mt-1">
              <input
                type="checkbox"
                className="mr-1 accent-blue-500"
                checked={!!search_state.filters.is_pet_friendly}
                onChange={e =>
                  handleBooleanFilterChange("is_pet_friendly", e.target.checked)
                }
              />
              Pet Friendly
            </label>
            <label className="flex items-center text-xs ml-1 mt-1">
              <input
                type="checkbox"
                className="mr-1 accent-blue-500"
                checked={!!search_state.filters.is_instant_book}
                onChange={e =>
                  handleBooleanFilterChange("is_instant_book", e.target.checked)
                }
              />
              Instant Book
            </label>
          </div>
          {/* Sort */}
          <div className="ml-0 md:ml-auto flex items-end h-full mt-2 md:mt-0">
            <label className="flex items-center text-xs">
              <span className="mr-1 text-gray-600">Sort:</span>
              <select
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                value={search_state.sort}
                onChange={handleSortChange}
              >
                {sortOptions.map(opt => (
                  <option value={opt.key} key={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* --- Results & List/Grid/Map Section --- */}
        <div className="flex flex-col-reverse md:flex-row gap-6 relative">
          {/* Villa grid/list */}
          <div className={map_open ? "md:w-2/3 w-full transition-all" : "w-full"}>
            {/* Loading/Error */}
            {isVillasLoading ? (
              <div className="flex flex-col items-center justify-center w-full py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
                <div className="text-gray-400 text-md">Loading villas...</div>
              </div>
            ) : fetchError ? (
              <div className="flex flex-col items-center text-center py-12">
                <span className="text-red-500 text-lg font-semibold mb-2">Error loading villas</span>
                <span className="text-sm mb-4">{fetchError}</span>
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                  onClick={() => refetch()}
                >
                  Retry
                </button>
              </div>
            ) : !villas.length ? (
              <div className="flex flex-col items-center py-16 max-w-lg mx-auto">
                <svg className="w-20 h-20 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 42V24.35a2 2 0 01.684-1.52L24 13l11.316 9.83a2 2 0 01.684 1.52V42M7 42h34" />
                </svg>
                <span className="text-lg font-semibold text-gray-700 mt-2">No villas found</span>
                <div className="text-gray-500 text-sm mt-2">
                  Try changing dates or looking in <button className="underline text-blue-600" onClick={() => {
                    navigate(`/search?location=${encodeURIComponent(altLocation)}`)
                  }}>{altLocation}</button>.
                </div>
                <div className="text-xs text-gray-400 mt-1">Still nothing? Try clearing price range and other filters above.</div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline justify-between mb-3 pl-1">
                  <span className="text-sm text-gray-600">
                    Showing {resStart}–{resEnd} of {totalResults} villas
                  </span>
                  {/* Pagination controls */}
                  <div className="flex items-center gap-x-1">
                    <button
                      className={`px-2 py-1 rounded-l border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 disabled:opacity-40`}
                      disabled={page <= 1}
                      onClick={() => goToPage(page - 1)}
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                    <span className="px-2 text-xs text-gray-600">
                      Page {page} of {pageQty}
                    </span>
                    <button
                      className={`px-2 py-1 rounded-r border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 disabled:opacity-40`}
                      disabled={page >= pageQty}
                      onClick={() => goToPage(page + 1)}
                      aria-label="Next page"
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {villas.map(villa => (
                    <div key={villa.villa_id} className="bg-white border rounded-lg shadow hover:shadow-lg group transition overflow-hidden relative">
                      <Link to={`/villa/${villa.villa_id}`} className="block w-full h-48 overflow-hidden">
                        <img
                          src={villa.main_photo_url || `https://picsum.photos/seed/villa_${villa.villa_id}/600/400`}
                          alt={villa.title}
                          className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        {villa.is_instant_book && (
                          <span className="absolute top-3 right-3 bg-green-500 text-xs text-white px-2 py-0.5 rounded font-bold shadow">Instant Book</span>
                        )}
                      </Link>
                      <div className="p-4">
                        <div className="flex justify-between items-center gap-x-2 mb-1">
                          <Link to={`/villa/${villa.villa_id}`} className="text-md font-bold text-gray-900 hover:underline truncate">
                            {villa.title}
                          </Link>
                          <span className="ml-auto inline-flex items-center gap-x-1 text-xs text-yellow-600 font-semibold">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.053 3.247a1 1 0 00.95.69h3.415c.969 0 1.372 1.24.588 1.81l-2.763 2.01a1 1 0 00-.364 1.118l1.053 3.247c.3.921-.755 1.688-1.54 1.118l-2.763-2.01a1 1 0 00-1.176 0l-2.763 2.01c-.784.57-1.838-.197-1.539-1.118l1.053-3.247a1 1 0 00-.364-1.118L2.98 8.674c-.783-.57-.38-1.81.588-1.81h3.415a1 1 0 00.951-.69l1.053-3.247z" />
                            </svg>
                            {villa.avg_rating?.toFixed(1)}
                            <span className="ml-1 text-gray-400 font-normal">({villa.reviews_count})</span>
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mb-1 truncate">{villa.address_city}</div>
                        <div className="flex items-end gap-x-1">
                          <span className="text-md font-extrabold text-blue-700">${villa.price_per_night}</span>
                          <span className="text-xs text-gray-600">/night</span>
                        </div>
                        <div className="flex gap-x-2 text-xs text-gray-500 my-1">
                          <span>{villa.bedrooms} bd</span>
                          <span>{villa.beds} beds</span>
                          <span>{villa.bathrooms} bath</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Pagination controls bottom */}
                {pageQty > 1 && (
                  <div className="flex justify-center mt-6 mb-3">
                    <button
                      className={`px-2 py-1 rounded-l border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 disabled:opacity-40`}
                      disabled={page <= 1}
                      onClick={() => goToPage(page - 1)}
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                    <span className="px-2 text-xs text-gray-600">
                      Page {page} of {pageQty}
                    </span>
                    <button
                      className={`px-2 py-1 rounded-r border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 disabled:opacity-40`}
                      disabled={page >= pageQty}
                      onClick={() => goToPage(page + 1)}
                      aria-label="Next page"
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          {/* Map Section (only renders when toggled) */}
          <div className={`md:w-1/3 w-full mb-4 md:mb-0 md:sticky md:top-24 transition-all duration-200 ${map_open ? "block" : "hidden"}`}>
            {/* Very basic map embed with markers - no mapbox or hallucinated libraries, placeholder with pins only */}
            <div className="h-[370px] md:h-[680px] w-full bg-blue-100 rounded-lg flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
              {/* Custom simple svg map with pin icons for villas */}
              <div className="absolute inset-0">
                <svg width="100%" height="100%" viewBox="0 0 320 320" fill="none">
                  {/* Base rectangle for 'sea' */}
                  <rect x="0" y="0" width="320" height="320" fill="#dbeafe" />
                  {/* Landmass */}
                  <ellipse cx="150" cy="200" rx="110" ry="80" fill="#bbf7d0" />
                  {/* Pins */}
                  {villas.map((villa, idx) => {
                    // Pseudo-random pin coords based on villa_id for demo
                    const x = 70 + 140 * ((idx + 1.5) % 2) + ((parseInt(String(villa.villa_id).slice(-2)) % 40));
                    const y = 130 + ((idx * 27) % 80);
                    return (
                      <g key={villa.villa_id}>
                        <a xlinkHref={`/villa/${villa.villa_id}`}>
                          <circle cx={x} cy={y} r="10" fill="#3b82f6" opacity="0.9"/>
                          <circle cx={x} cy={y - 2} r="5" fill="#fbbf24" opacity="0.9"/>
                        </a>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <span className="relative z-10 text-base font-semibold text-blue-900 mt-3">Map Preview</span>
              <span className="relative z-10 text-sm text-gray-400">(Pins are illustrative, not 1:1 accurate)</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_SearchResults;