import { z } from "zod";

// ===========================
// USERS
// ===========================

export const userSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  display_name: z.string().nullable(),
  profile_photo_url: z.string().nullable(),
  bio: z.string().nullable(),
  contact_email: z.string().email().nullable(),
  is_host: z.boolean(),
  is_superhost: z.boolean(),
  last_active_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createUserInputSchema = z.object({
  user_id: z.string().min(1).max(128),
  email: z.string().email().max(255),
  password_hash: z.string().min(8),
  display_name: z.string().min(1).max(255),
  profile_photo_url: z.string().url().max(2048).nullable(),
  bio: z.string().max(4096).nullable(),
  contact_email: z.string().email().max(255).nullable(),
  is_host: z.boolean().default(false),
  is_superhost: z.boolean().default(false),
  last_active_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const updateUserInputSchema = z.object({
  user_id: z.string(),
  email: z.string().email().max(255).optional(),
  password_hash: z.string().min(8).optional(),
  display_name: z.string().max(255).nullable().optional(),
  profile_photo_url: z.string().url().max(2048).nullable().optional(),
  bio: z.string().max(4096).nullable().optional(),
  contact_email: z.string().email().max(255).nullable().optional(),
  is_host: z.boolean().optional(),
  is_superhost: z.boolean().optional(),
  last_active_at: z.coerce.date().optional().nullable(),
});

export const searchUserInputSchema = z.object({
  query: z.string().optional(),
  is_host: z.boolean().optional(),
  is_superhost: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z
    .enum(["created_at", "email", "display_name"])
    .default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;

// ===========================
// VILLAS
// ===========================

export const villaSchema = z.object({
  villa_id: z.string(),
  owner_user_id: z.string(),
  title: z.string(),
  description_short: z.string().nullable(),
  description_long: z.string().nullable(),
  address_street: z.string().nullable(),
  address_city: z.string(),
  address_area: z.string().nullable(),
  address_postal_code: z.string().nullable(),
  address_country: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  main_photo_url: z.string().nullable(),
  cancellation_policy: z.string(),
  min_nights: z.number().int(),
  max_nights: z.number().int(),
  bedrooms: z.number().int(),
  beds: z.number().int(),
  bathrooms: z.number().int(),
  max_guests: z.number().int(),
  price_per_night: z.number(),
  cleaning_fee: z.number(),
  service_fee: z.number(),
  taxes: z.number(),
  is_active: z.boolean(),
  is_beachfront: z.boolean(),
  is_pet_friendly: z.boolean(),
  is_instant_book: z.boolean(),
  house_rules: z.string().nullable(),
  published_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createVillaInputSchema = z.object({
  villa_id: z.string().min(1).max(128),
  owner_user_id: z.string().min(1).max(128),
  title: z.string().min(1).max(255),
  description_short: z.string().max(500).nullable(),
  description_long: z.string().max(4096).nullable(),
  address_street: z.string().max(255).nullable(),
  address_city: z.string().min(1).max(255),
  address_area: z.string().max(255).nullable(),
  address_postal_code: z.string().max(16).nullable(),
  address_country: z.string().max(64),
  latitude: z.number(),
  longitude: z.number(),
  main_photo_url: z.string().url().max(2048).nullable(),
  cancellation_policy: z.string().min(1).max(255),
  min_nights: z.number().int().positive(),
  max_nights: z.number().int().positive(),
  bedrooms: z.number().int().min(1).max(100),
  beds: z.number().int().min(1).max(200),
  bathrooms: z.number().int().min(1).max(100),
  max_guests: z.number().int().min(1).max(1000),
  price_per_night: z.number().min(0),
  cleaning_fee: z.number().min(0),
  service_fee: z.number().min(0),
  taxes: z.number().min(0),
  is_active: z.boolean().default(true),
  is_beachfront: z.boolean().default(false),
  is_pet_friendly: z.boolean().default(false),
  is_instant_book: z.boolean().default(false),
  house_rules: z.string().max(2048).nullable(),
  published_at: z.coerce.date().nullable(),
});

export const updateVillaInputSchema = z.object({
  villa_id: z.string(),
  title: z.string().min(1).max(255).optional(),
  description_short: z.string().max(500).nullable().optional(),
  description_long: z.string().max(4096).nullable().optional(),
  address_street: z.string().max(255).nullable().optional(),
  address_city: z.string().min(1).max(255).optional(),
  address_area: z.string().max(255).nullable().optional(),
  address_postal_code: z.string().max(16).nullable().optional(),
  address_country: z.string().max(64).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  main_photo_url: z.string().url().max(2048).nullable().optional(),
  cancellation_policy: z.string().min(1).max(255).optional(),
  min_nights: z.number().int().positive().optional(),
  max_nights: z.number().int().positive().optional(),
  bedrooms: z.number().int().min(1).max(100).optional(),
  beds: z.number().int().min(1).max(200).optional(),
  bathrooms: z.number().int().min(1).max(100).optional(),
  max_guests: z.number().int().min(1).max(1000).optional(),
  price_per_night: z.number().min(0).optional(),
  cleaning_fee: z.number().min(0).optional(),
  service_fee: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
  is_beachfront: z.boolean().optional(),
  is_pet_friendly: z.boolean().optional(),
  is_instant_book: z.boolean().optional(),
  house_rules: z.string().max(2048).nullable().optional(),
  published_at: z.coerce.date().nullable().optional(),
});

export const searchVillaInputSchema = z.object({
  query: z.string().optional(),
  address_city: z.string().optional(),
  address_country: z.string().optional(),
  min_guests: z.number().int().min(1).optional(),
  min_nights: z.number().int().min(1).optional(),
  max_price: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
  is_beachfront: z.boolean().optional(),
  is_pet_friendly: z.boolean().optional(),
  is_instant_book: z.boolean().optional(),
  bedrooms: z.number().int().min(1).optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z
    .enum(["created_at", "price_per_night", "max_guests"])
    .default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type Villa = z.infer<typeof villaSchema>;
export type CreateVillaInput = z.infer<typeof createVillaInputSchema>;
export type UpdateVillaInput = z.infer<typeof updateVillaInputSchema>;
export type SearchVillaInput = z.infer<typeof searchVillaInputSchema>;

// ===========================
// VILLA_PHOTOS
// ===========================

export const villaPhotoSchema = z.object({
  villa_photo_id: z.string(),
  villa_id: z.string(),
  photo_url: z.string(),
  ordering: z.number().int(),
  is_main: z.boolean(),
  uploaded_at: z.coerce.date(),
});

export const createVillaPhotoInputSchema = z.object({
  villa_photo_id: z.string().min(1).max(128),
  villa_id: z.string(),
  photo_url: z.string().url().max(2048),
  ordering: z.number().int().min(1),
  is_main: z.boolean().default(false),
});

export const updateVillaPhotoInputSchema = z.object({
  villa_photo_id: z.string(),
  photo_url: z.string().url().max(2048).optional(),
  ordering: z.number().int().min(1).optional(),
  is_main: z.boolean().optional(),
});

export const searchVillaPhotoInputSchema = z.object({
  villa_id: z.string().optional(),
  is_main: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["ordering", "uploaded_at"]).default("ordering"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

export type VillaPhoto = z.infer<typeof villaPhotoSchema>;
export type CreateVillaPhotoInput = z.infer<typeof createVillaPhotoInputSchema>;
export type UpdateVillaPhotoInput = z.infer<typeof updateVillaPhotoInputSchema>;
export type SearchVillaPhotoInput = z.infer<typeof searchVillaPhotoInputSchema>;

// ===========================
// AMENITIES
// ===========================

export const amenitySchema = z.object({
  amenity_id: z.number().int(),
  label: z.string(),
  icon_url: z.string().nullable(),
  created_at: z.coerce.date(),
});

export const createAmenityInputSchema = z.object({
  label: z.string().min(1).max(128),
  icon_url: z.string().url().max(2048).nullable(),
});

export const updateAmenityInputSchema = z.object({
  amenity_id: z.number().int(),
  label: z.string().min(1).max(128).optional(),
  icon_url: z.string().url().max(2048).nullable().optional(),
});

export const searchAmenityInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(30),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["label", "created_at"]).default("label"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

export type Amenity = z.infer<typeof amenitySchema>;
export type CreateAmenityInput = z.infer<typeof createAmenityInputSchema>;
export type UpdateAmenityInput = z.infer<typeof updateAmenityInputSchema>;
export type SearchAmenityInput = z.infer<typeof searchAmenityInputSchema>;

// ===========================
// VILLA_AMENITIES
// ===========================

export const villaAmenitySchema = z.object({
  villa_amenity_id: z.string(),
  villa_id: z.string(),
  amenity_id: z.number().int(),
});

export const createVillaAmenityInputSchema = z.object({
  villa_amenity_id: z.string().min(1).max(128),
  villa_id: z.string(),
  amenity_id: z.number().int(),
});

export const updateVillaAmenityInputSchema = z.object({
  villa_amenity_id: z.string(),
  villa_id: z.string().optional(),
  amenity_id: z.number().int().optional(),
});

export const searchVillaAmenityInputSchema = z.object({
  villa_id: z.string().optional(),
  amenity_id: z.number().int().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["villa_id", "amenity_id"]).default("villa_id"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

export type VillaAmenity = z.infer<typeof villaAmenitySchema>;
export type CreateVillaAmenityInput = z.infer<
  typeof createVillaAmenityInputSchema
>;
export type UpdateVillaAmenityInput = z.infer<
  typeof updateVillaAmenityInputSchema
>;
export type SearchVillaAmenityInput = z.infer<
  typeof searchVillaAmenityInputSchema
>;

// ===========================
// VILLA_RULES
// ===========================

export const villaRuleSchema = z.object({
  villa_rule_id: z.string(),
  villa_id: z.string(),
  rule_type: z.string(),
  allowed: z.boolean(),
  notes: z.string().nullable(),
});

export const createVillaRuleInputSchema = z.object({
  villa_rule_id: z.string().min(1).max(128),
  villa_id: z.string(),
  rule_type: z.string().min(1).max(64),
  allowed: z.boolean(),
  notes: z.string().max(2048).nullable(),
});

export const updateVillaRuleInputSchema = z.object({
  villa_rule_id: z.string(),
  rule_type: z.string().min(1).max(64).optional(),
  allowed: z.boolean().optional(),
  notes: z.string().max(2048).nullable().optional(),
});

export const searchVillaRuleInputSchema = z.object({
  villa_id: z.string().optional(),
  rule_type: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["rule_type", "villa_id"]).default("rule_type"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

export type VillaRule = z.infer<typeof villaRuleSchema>;
export type CreateVillaRuleInput = z.infer<typeof createVillaRuleInputSchema>;
export type UpdateVillaRuleInput = z.infer<typeof updateVillaRuleInputSchema>;
export type SearchVillaRuleInput = z.infer<typeof searchVillaRuleInputSchema>;

// ===========================
// VILLA_CALENDAR
// ===========================

export const villaCalendarSchema = z.object({
  villa_calendar_id: z.string(),
  villa_id: z.string(),
  date: z.string(), // ISO date (not datetime)
  is_available: z.boolean(),
  reason: z.string().nullable(),
  updated_at: z.coerce.date(),
});

export const createVillaCalendarInputSchema = z.object({
  villa_calendar_id: z.string().min(1).max(128),
  villa_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO8601 date
  is_available: z.boolean().default(true),
  reason: z.string().max(255).nullable(),
});

export const updateVillaCalendarInputSchema = z.object({
  villa_calendar_id: z.string(),
  is_available: z.boolean().optional(),
  reason: z.string().max(255).nullable().optional(),
});

export const searchVillaCalendarInputSchema = z.object({
  villa_id: z.string().optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  is_available: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["date", "updated_at"]).default("date"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

export type VillaCalendar = z.infer<typeof villaCalendarSchema>;
export type CreateVillaCalendarInput = z.infer<
  typeof createVillaCalendarInputSchema
>;
export type UpdateVillaCalendarInput = z.infer<
  typeof updateVillaCalendarInputSchema
>;
export type SearchVillaCalendarInput = z.infer<
  typeof searchVillaCalendarInputSchema
>;

// ===========================
// VILLA_PRICING_OVERRIDES
// ===========================

export const villaPricingOverrideSchema = z.object({
  villa_pricing_override_id: z.string(),
  villa_id: z.string(),
  date: z.string(), // ISO date
  nightly_price: z.number(),
  min_nights: z.number().int().nullable(),
  max_nights: z.number().int().nullable(),
  updated_at: z.coerce.date(),
});

export const createVillaPricingOverrideInputSchema = z.object({
  villa_pricing_override_id: z.string().min(1).max(128),
  villa_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nightly_price: z.number().min(0),
  min_nights: z.number().int().min(1).nullable(),
  max_nights: z.number().int().min(1).nullable(),
});

export const updateVillaPricingOverrideInputSchema = z.object({
  villa_pricing_override_id: z.string(),
  nightly_price: z.number().min(0).optional(),
  min_nights: z.number().int().min(1).nullable().optional(),
  max_nights: z.number().int().min(1).nullable().optional(),
});

export const searchVillaPricingOverrideInputSchema = z.object({
  villa_id: z.string().optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["date", "updated_at"]).default("date"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

export type VillaPricingOverride = z.infer<typeof villaPricingOverrideSchema>;
export type CreateVillaPricingOverrideInput = z.infer<
  typeof createVillaPricingOverrideInputSchema
>;
export type UpdateVillaPricingOverrideInput = z.infer<
  typeof updateVillaPricingOverrideInputSchema
>;
export type SearchVillaPricingOverrideInput = z.infer<
  typeof searchVillaPricingOverrideInputSchema
>;

// ===========================
// VILLA_WISHLISTS
// ===========================

export const villaWishlistSchema = z.object({
  wishlist_id: z.string(),
  user_id: z.string(),
  name: z.string(),
  is_deleted: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createVillaWishlistInputSchema = z.object({
  wishlist_id: z.string().min(1).max(128),
  user_id: z.string(),
  name: z.string().min(1).max(255),
  is_deleted: z.boolean().default(false),
});

export const updateVillaWishlistInputSchema = z.object({
  wishlist_id: z.string(),
  name: z.string().min(1).max(255).optional(),
  is_deleted: z.boolean().optional(),
});

export const searchVillaWishlistInputSchema = z.object({
  user_id: z.string().optional(),
  is_deleted: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["created_at", "name"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type VillaWishlist = z.infer<typeof villaWishlistSchema>;
export type CreateVillaWishlistInput = z.infer<
  typeof createVillaWishlistInputSchema
>;
export type UpdateVillaWishlistInput = z.infer<
  typeof updateVillaWishlistInputSchema
>;
export type SearchVillaWishlistInput = z.infer<
  typeof searchVillaWishlistInputSchema
>;

// ===========================
// WISHLIST_ITEMS
// ===========================

export const wishlistItemSchema = z.object({
  wishlist_item_id: z.string(),
  wishlist_id: z.string(),
  villa_id: z.string(),
  added_at: z.coerce.date(),
});

export const createWishlistItemInputSchema = z.object({
  wishlist_item_id: z.string().min(1).max(128),
  wishlist_id: z.string(),
  villa_id: z.string(),
});

export const updateWishlistItemInputSchema = z.object({
  wishlist_item_id: z.string(),
  villa_id: z.string().optional(),
});

export const searchWishlistItemInputSchema = z.object({
  wishlist_id: z.string().optional(),
  villa_id: z.string().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["added_at"]).default("added_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type WishlistItem = z.infer<typeof wishlistItemSchema>;
export type CreateWishlistItemInput = z.infer<
  typeof createWishlistItemInputSchema
>;
export type UpdateWishlistItemInput = z.infer<
  typeof updateWishlistItemInputSchema
>;
export type SearchWishlistItemInput = z.infer<
  typeof searchWishlistItemInputSchema
>;

// ===========================
// BOOKINGS
// ===========================

export const bookingSchema = z.object({
  booking_id: z.string(),
  villa_id: z.string(),
  guest_user_id: z.string(),
  host_user_id: z.string(),
  checkin_date: z.string(),
  checkout_date: z.string(),
  num_guests: z.number().int(),
  status: z.string(),
  is_instant_book: z.boolean(),
  nightly_price: z.number(),
  cleaning_fee: z.number(),
  service_fee: z.number(),
  taxes: z.number(),
  total_price: z.number(),
  payment_status: z.string(),
  cancellation_date: z.coerce.date().nullable(),
  cancellation_reason: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createBookingInputSchema = z.object({
  booking_id: z.string().min(1).max(128),
  villa_id: z.string(),
  guest_user_id: z.string(),
  host_user_id: z.string(),
  checkin_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkout_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  num_guests: z.number().int().min(1),
  status: z.string().min(1).max(32), // optionally use z.enum etc.
  is_instant_book: z.boolean().default(false),
  nightly_price: z.number().min(0),
  cleaning_fee: z.number().min(0),
  service_fee: z.number().min(0),
  taxes: z.number().min(0),
  total_price: z.number().min(0),
  payment_status: z.string().min(1).max(32),
  cancellation_date: z.coerce.date().nullable(),
  cancellation_reason: z.string().max(2048).nullable(),
});

export const updateBookingInputSchema = z.object({
  booking_id: z.string(),
  status: z.string().min(1).max(32).optional(),
  is_instant_book: z.boolean().optional(),
  nightly_price: z.number().min(0).optional(),
  cleaning_fee: z.number().min(0).optional(),
  service_fee: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  total_price: z.number().min(0).optional(),
  payment_status: z.string().min(1).max(32).optional(),
  cancellation_date: z.coerce.date().nullable().optional(),
  cancellation_reason: z.string().max(2048).nullable().optional(),
  checkin_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  checkout_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  num_guests: z.number().int().min(1).optional(),
});

export const searchBookingInputSchema = z.object({
  villa_id: z.string().optional(),
  guest_user_id: z.string().optional(),
  host_user_id: z.string().optional(),
  status: z.string().optional(),
  payment_status: z.string().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z
    .enum(["created_at", "checkin_date", "checkout_date", "status"])
    .default("checkin_date"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type Booking = z.infer<typeof bookingSchema>;
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;
export type SearchBookingInput = z.infer<typeof searchBookingInputSchema>;

// ===========================
// BOOKING_HISTORIES
// ===========================

export const bookingHistorySchema = z.object({
  booking_history_id: z.string(),
  booking_id: z.string(),
  action: z.string(),
  previous_value: z.string().nullable(),
  new_value: z.string().nullable(),
  action_by_user_id: z.string().nullable(),
  action_at: z.coerce.date(),
});

export const createBookingHistoryInputSchema = z.object({
  booking_history_id: z.string().min(1).max(128),
  booking_id: z.string(),
  action: z.string().min(1).max(64),
  previous_value: z.string().max(2048).nullable(),
  new_value: z.string().max(2048).nullable(),
  action_by_user_id: z.string().optional(), // nullable, but could be omitted
});

export const updateBookingHistoryInputSchema = z.object({
  booking_history_id: z.string(),
  action: z.string().min(1).max(64).optional(),
  previous_value: z.string().max(2048).nullable().optional(),
  new_value: z.string().max(2048).nullable().optional(),
  action_by_user_id: z.string().optional(),
});

export const searchBookingHistoryInputSchema = z.object({
  booking_id: z.string().optional(),
  action_by_user_id: z.string().optional(),
  action: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["action_at", "action"]).default("action_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type BookingHistory = z.infer<typeof bookingHistorySchema>;
export type CreateBookingHistoryInput = z.infer<
  typeof createBookingHistoryInputSchema
>;
export type UpdateBookingHistoryInput = z.infer<
  typeof updateBookingHistoryInputSchema
>;
export type SearchBookingHistoryInput = z.infer<
  typeof searchBookingHistoryInputSchema
>;

// ===========================
// BOOKING_GUESTS
// ===========================

export const bookingGuestSchema = z.object({
  booking_guest_id: z.string(),
  booking_id: z.string(),
  guest_name: z.string(),
  guest_email: z.string().email(),
  special_requests: z.string().nullable(),
});

export const createBookingGuestInputSchema = z.object({
  booking_guest_id: z.string().min(1).max(128),
  booking_id: z.string(),
  guest_name: z.string().min(1).max(128),
  guest_email: z.string().email(),
  special_requests: z.string().max(2048).nullable(),
});

export const updateBookingGuestInputSchema = z.object({
  booking_guest_id: z.string(),
  guest_name: z.string().min(1).max(128).optional(),
  guest_email: z.string().email().optional(),
  special_requests: z.string().max(2048).nullable().optional(),
});

export const searchBookingGuestInputSchema = z.object({
  booking_id: z.string().optional(),
  guest_email: z.string().email().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["guest_name", "booking_id"]).default("guest_name"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

export type BookingGuest = z.infer<typeof bookingGuestSchema>;
export type CreateBookingGuestInput = z.infer<
  typeof createBookingGuestInputSchema
>;
export type UpdateBookingGuestInput = z.infer<
  typeof updateBookingGuestInputSchema
>;
export type SearchBookingGuestInput = z.infer<
  typeof searchBookingGuestInputSchema
>;

// ===========================
// BOOKING_PAYMENTS
// ===========================

export const bookingPaymentSchema = z.object({
  booking_payment_id: z.string(),
  booking_id: z.string(),
  user_id: z.string(),
  amount: z.number(),
  status: z.string(),
  provider: z.string(),
  processed_at: z.coerce.date().nullable(),
});

export const createBookingPaymentInputSchema = z.object({
  booking_payment_id: z.string().min(1).max(128),
  booking_id: z.string(),
  user_id: z.string(),
  amount: z.number().min(0.01), // must be positive
  status: z.string().min(1).max(32),
  provider: z.string().min(1).max(64),
  processed_at: z.coerce.date().nullable(),
});

export const updateBookingPaymentInputSchema = z.object({
  booking_payment_id: z.string(),
  status: z.string().min(1).max(32).optional(),
  provider: z.string().min(1).max(64).optional(),
  processed_at: z.coerce.date().nullable().optional(),
});

export const searchBookingPaymentInputSchema = z.object({
  booking_id: z.string().optional(),
  user_id: z.string().optional(),
  status: z.string().optional(),
  provider: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["processed_at", "amount"]).default("processed_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type BookingPayment = z.infer<typeof bookingPaymentSchema>;
export type CreateBookingPaymentInput = z.infer<
  typeof createBookingPaymentInputSchema
>;
export type UpdateBookingPaymentInput = z.infer<
  typeof updateBookingPaymentInputSchema
>;
export type SearchBookingPaymentInput = z.infer<
  typeof searchBookingPaymentInputSchema
>;

// ===========================
// MESSAGE_THREADS
// ===========================

export const messageThreadSchema = z.object({
  thread_id: z.string(),
  participant_user_id: z.string(),
  villa_id: z.string().nullable(),
  booking_id: z.string().nullable(),
  last_message_preview: z.string().nullable(),
  unread_count: z.number().int(),
  updated_at: z.coerce.date(),
});

export const createMessageThreadInputSchema = z.object({
  thread_id: z.string().min(1).max(128),
  participant_user_id: z.string(),
  villa_id: z.string().nullable(),
  booking_id: z.string().nullable(),
  last_message_preview: z.string().max(2048).nullable(),
  unread_count: z.number().int().min(0).default(0),
});

export const updateMessageThreadInputSchema = z.object({
  thread_id: z.string(),
  last_message_preview: z.string().max(2048).nullable().optional(),
  unread_count: z.number().int().min(0).optional(),
});

export const searchMessageThreadInputSchema = z.object({
  participant_user_id: z.string().optional(),
  villa_id: z.string().optional(),
  booking_id: z.string().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["updated_at"]).default("updated_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type MessageThread = z.infer<typeof messageThreadSchema>;
export type CreateMessageThreadInput = z.infer<
  typeof createMessageThreadInputSchema
>;
export type UpdateMessageThreadInput = z.infer<
  typeof updateMessageThreadInputSchema
>;
export type SearchMessageThreadInput = z.infer<
  typeof searchMessageThreadInputSchema
>;

// ===========================
// MESSAGES
// ===========================

export const messageSchema = z.object({
  message_id: z.string(),
  thread_id: z.string(),
  sender_user_id: z.string(),
  recipient_user_id: z.string(),
  content: z.string(),
  is_read: z.boolean(),
  sent_at: z.coerce.date(),
});

export const createMessageInputSchema = z.object({
  message_id: z.string().min(1).max(128),
  thread_id: z.string(),
  sender_user_id: z.string(),
  recipient_user_id: z.string(),
  content: z.string().min(1).max(8192),
  is_read: z.boolean().default(false),
});

export const updateMessageInputSchema = z.object({
  message_id: z.string(),
  content: z.string().min(1).max(8192).optional(),
  is_read: z.boolean().optional(),
});

export const searchMessageInputSchema = z.object({
  thread_id: z.string().optional(),
  sender_user_id: z.string().optional(),
  recipient_user_id: z.string().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["sent_at"]).default("sent_at"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

export type Message = z.infer<typeof messageSchema>;
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>;
export type SearchMessageInput = z.infer<typeof searchMessageInputSchema>;

// ===========================
// USER_REVIEWS
// ===========================

export const userReviewSchema = z.object({
  review_id: z.string(),
  booking_id: z.string(),
  guest_user_id: z.string(),
  villa_id: z.string(),
  host_user_id: z.string(),
  rating: z.number().int(),
  text: z.string().nullable(),
  is_edited: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createUserReviewInputSchema = z.object({
  review_id: z.string().min(1).max(128),
  booking_id: z.string(),
  guest_user_id: z.string(),
  villa_id: z.string(),
  host_user_id: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(4096).nullable(),
  is_edited: z.boolean().default(false),
});

export const updateUserReviewInputSchema = z.object({
  review_id: z.string(),
  text: z.string().max(4096).nullable().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  is_edited: z.boolean().optional(),
});

export const searchUserReviewInputSchema = z.object({
  villa_id: z.string().optional(),
  guest_user_id: z.string().optional(),
  host_user_id: z.string().optional(),
  rating: z.number().int().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["created_at", "rating"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type UserReview = z.infer<typeof userReviewSchema>;
export type CreateUserReviewInput = z.infer<typeof createUserReviewInputSchema>;
export type UpdateUserReviewInput = z.infer<typeof updateUserReviewInputSchema>;
export type SearchUserReviewInput = z.infer<typeof searchUserReviewInputSchema>;

// ===========================
// GUEST_REVIEWS
// ===========================

export const guestReviewSchema = z.object({
  guest_review_id: z.string(),
  booking_id: z.string(),
  host_user_id: z.string(),
  guest_user_id: z.string(),
  rating: z.number().int(),
  text: z.string().nullable(),
  is_edited: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createGuestReviewInputSchema = z.object({
  guest_review_id: z.string().min(1).max(128),
  booking_id: z.string(),
  host_user_id: z.string(),
  guest_user_id: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(4096).nullable(),
  is_edited: z.boolean().default(false),
});

export const updateGuestReviewInputSchema = z.object({
  guest_review_id: z.string(),
  text: z.string().max(4096).nullable().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  is_edited: z.boolean().optional(),
});

export const searchGuestReviewInputSchema = z.object({
  host_user_id: z.string().optional(),
  guest_user_id: z.string().optional(),
  rating: z.number().int().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["created_at", "rating"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type GuestReview = z.infer<typeof guestReviewSchema>;
export type CreateGuestReviewInput = z.infer<
  typeof createGuestReviewInputSchema
>;
export type UpdateGuestReviewInput = z.infer<
  typeof updateGuestReviewInputSchema
>;
export type SearchGuestReviewInput = z.infer<
  typeof searchGuestReviewInputSchema
>;

// ===========================
// SUPERHOST_HISTORY
// ===========================

export const superhostHistorySchema = z.object({
  superhost_history_id: z.string(),
  host_user_id: z.string(),
  is_superhost: z.boolean(),
  qualifying_reviews: z.number().int(),
  qualifying_avg_rating: z.number(),
  became_superhost_at: z.coerce.date().nullable(),
  removed_superhost_at: z.coerce.date().nullable(),
});

export const createSuperhostHistoryInputSchema = z.object({
  superhost_history_id: z.string().min(1).max(128),
  host_user_id: z.string(),
  is_superhost: z.boolean(),
  qualifying_reviews: z.number().int().min(0),
  qualifying_avg_rating: z.number().min(0).max(5),
  became_superhost_at: z.coerce.date().nullable(),
  removed_superhost_at: z.coerce.date().nullable(),
});

export const updateSuperhostHistoryInputSchema = z.object({
  superhost_history_id: z.string(),
  is_superhost: z.boolean().optional(),
  qualifying_reviews: z.number().int().min(0).optional(),
  qualifying_avg_rating: z.number().min(0).max(5).optional(),
  became_superhost_at: z.coerce.date().nullable().optional(),
  removed_superhost_at: z.coerce.date().nullable().optional(),
});

export const searchSuperhostHistoryInputSchema = z.object({
  host_user_id: z.string().optional(),
  is_superhost: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z
    .enum(["became_superhost_at", "removed_superhost_at"])
    .default("became_superhost_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type SuperhostHistory = z.infer<typeof superhostHistorySchema>;
export type CreateSuperhostHistoryInput = z.infer<
  typeof createSuperhostHistoryInputSchema
>;
export type UpdateSuperhostHistoryInput = z.infer<
  typeof updateSuperhostHistoryInputSchema
>;
export type SearchSuperhostHistoryInput = z.infer<
  typeof searchSuperhostHistoryInputSchema
>;

// ===========================
// NOTIFICATIONS
// ===========================

export const notificationSchema = z.object({
  notification_id: z.string(),
  user_id: z.string(),
  type: z.string(),
  message: z.string(),
  is_read: z.boolean(),
  reference_id: z.string().nullable(),
  created_at: z.coerce.date(),
});

export const createNotificationInputSchema = z.object({
  notification_id: z.string().min(1).max(128),
  user_id: z.string(),
  type: z.string().min(1).max(64),
  message: z.string().min(1).max(2048),
  is_read: z.boolean().default(false),
  reference_id: z.string().nullable(),
});

export const updateNotificationInputSchema = z.object({
  notification_id: z.string(),
  is_read: z.boolean().optional(),
});

export const searchNotificationInputSchema = z.object({
  user_id: z.string().optional(),
  type: z.string().optional(),
  is_read: z.boolean().optional(),
  reference_id: z.string().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["created_at"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotificationInput = z.infer<
  typeof createNotificationInputSchema
>;
export type UpdateNotificationInput = z.infer<
  typeof updateNotificationInputSchema
>;
export type SearchNotificationInput = z.infer<
  typeof searchNotificationInputSchema
>;

// ===========================
// PASSWORD_RESETS
// ===========================

export const passwordResetSchema = z.object({
  password_reset_id: z.string(),
  user_id: z.string(),
  reset_code: z.string(),
  expires_at: z.coerce.date(),
  used: z.boolean(),
  created_at: z.coerce.date(),
});

export const createPasswordResetInputSchema = z.object({
  password_reset_id: z.string().min(1).max(128),
  user_id: z.string(),
  reset_code: z.string().min(1).max(128),
  expires_at: z.coerce.date(),
  used: z.boolean().default(false),
});

export const updatePasswordResetInputSchema = z.object({
  password_reset_id: z.string(),
  used: z.boolean().optional(),
});

export const searchPasswordResetInputSchema = z.object({
  user_id: z.string().optional(),
  used: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(["created_at", "expires_at"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type CreatePasswordResetInput = z.infer<
  typeof createPasswordResetInputSchema
>;
export type UpdatePasswordResetInput = z.infer<
  typeof updatePasswordResetInputSchema
>;
export type SearchPasswordResetInput = z.infer<
  typeof searchPasswordResetInputSchema
>;
