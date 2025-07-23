-- ========================================
-- BEACHSTAY VILLAS PRODUCTION DATABASE SCHEMA
-- (Hand-crafted for maximum compliance with requirements)
-- ========================================
-- All IDs are strings, not generated in the DB!
-- All dates as TEXT (ISO8601), booleans as BOOLEAN, numerics as INTEGER/NUMERIC
-- No UUID/database-generated columns anywhere
-- ========================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
  user_id                 VARCHAR PRIMARY KEY,
  email                   VARCHAR NOT NULL UNIQUE,
  password_hash           VARCHAR NOT NULL,
  display_name            VARCHAR,
  profile_photo_url       VARCHAR,
  bio                     TEXT,
  contact_email           VARCHAR,
  is_host                 BOOLEAN NOT NULL DEFAULT FALSE,
  is_superhost            BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at          TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

-- VILLAS
CREATE TABLE IF NOT EXISTS villas (
  villa_id                VARCHAR PRIMARY KEY,
  owner_user_id           VARCHAR NOT NULL,
  title                   VARCHAR NOT NULL,
  description_short       VARCHAR,
  description_long        TEXT,
  address_street          VARCHAR,
  address_city            VARCHAR NOT NULL,
  address_area            VARCHAR,
  address_postal_code     VARCHAR,
  address_country         VARCHAR NOT NULL,
  latitude                NUMERIC NOT NULL,
  longitude               NUMERIC NOT NULL,
  main_photo_url          VARCHAR,
  cancellation_policy     VARCHAR NOT NULL,
  min_nights              INTEGER NOT NULL,
  max_nights              INTEGER NOT NULL,
  bedrooms                INTEGER NOT NULL,
  beds                    INTEGER NOT NULL,
  bathrooms               INTEGER NOT NULL,
  max_guests              INTEGER NOT NULL,
  price_per_night         NUMERIC NOT NULL,
  cleaning_fee            NUMERIC NOT NULL,
  service_fee             NUMERIC NOT NULL,
  taxes                   NUMERIC NOT NULL,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  is_beachfront           BOOLEAN NOT NULL DEFAULT FALSE,
  is_pet_friendly         BOOLEAN NOT NULL DEFAULT FALSE,
  is_instant_book         BOOLEAN NOT NULL DEFAULT FALSE,
  house_rules             TEXT,
  published_at            TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
);

-- VILLA_PHOTOS
CREATE TABLE IF NOT EXISTS villa_photos (
  villa_photo_id          VARCHAR PRIMARY KEY,
  villa_id                VARCHAR NOT NULL,
  photo_url               VARCHAR NOT NULL,
  ordering                INTEGER NOT NULL,
  is_main                 BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at             TEXT NOT NULL,
  FOREIGN KEY (villa_id) REFERENCES villas(villa_id)
);

-- AMENITIES (Master amenity list)
CREATE TABLE IF NOT EXISTS amenities (
  amenity_id              INTEGER PRIMARY KEY,
  label                   VARCHAR NOT NULL,
  icon_url                VARCHAR,
  created_at              TEXT NOT NULL
);

-- VILLA_AMENITIES (many-to-many)
CREATE TABLE IF NOT EXISTS villa_amenities (
  villa_amenity_id        VARCHAR PRIMARY KEY,
  villa_id                VARCHAR NOT NULL,
  amenity_id              INTEGER NOT NULL,
  FOREIGN KEY (villa_id) REFERENCES villas(villa_id),
  FOREIGN KEY (amenity_id) REFERENCES amenities(amenity_id)
);

-- VILLA_RULES
CREATE TABLE IF NOT EXISTS villa_rules (
  villa_rule_id           VARCHAR PRIMARY KEY,
  villa_id                VARCHAR NOT NULL,
  rule_type               VARCHAR NOT NULL,
  allowed                 BOOLEAN NOT NULL,
  notes                   VARCHAR,
  FOREIGN KEY (villa_id) REFERENCES villas(villa_id)
);

-- VILLA_CALENDAR
CREATE TABLE IF NOT EXISTS villa_calendar (
  villa_calendar_id       VARCHAR PRIMARY KEY,
  villa_id                VARCHAR NOT NULL,
  date                    TEXT NOT NULL,
  is_available            BOOLEAN NOT NULL DEFAULT TRUE,
  reason                  VARCHAR,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (villa_id) REFERENCES villas(villa_id)
);

-- VILLA_PRICING_OVERRIDES
CREATE TABLE IF NOT EXISTS villa_pricing_overrides (
  villa_pricing_override_id VARCHAR PRIMARY KEY,
  villa_id                VARCHAR NOT NULL,
  date                    TEXT NOT NULL,
  nightly_price           NUMERIC NOT NULL,
  min_nights              INTEGER,
  max_nights              INTEGER,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (villa_id) REFERENCES villas(villa_id)
);

-- WISHLISTS
CREATE TABLE IF NOT EXISTS villa_wishlists (
  wishlist_id             VARCHAR PRIMARY KEY,
  user_id                 VARCHAR NOT NULL,
  name                    VARCHAR NOT NULL,
  is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  wishlist_item_id        VARCHAR PRIMARY KEY,
  wishlist_id             VARCHAR NOT NULL,
  villa_id                VARCHAR NOT NULL,
  added_at                TEXT NOT NULL,
  FOREIGN KEY (wishlist_id) REFERENCES villa_wishlists(wishlist_id),
  FOREIGN KEY (villa_id) REFERENCES villas(villa_id)
);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  booking_id              VARCHAR PRIMARY KEY,
  villa_id                VARCHAR NOT NULL,
  guest_user_id           VARCHAR NOT NULL,
  host_user_id            VARCHAR NOT NULL,
  checkin_date            TEXT NOT NULL,
  checkout_date           TEXT NOT NULL,
  num_guests              INTEGER NOT NULL,
  status                  VARCHAR NOT NULL,
  is_instant_book         BOOLEAN NOT NULL DEFAULT FALSE,
  nightly_price           NUMERIC NOT NULL,
  cleaning_fee            NUMERIC NOT NULL,
  service_fee             NUMERIC NOT NULL,
  taxes                   NUMERIC NOT NULL,
  total_price             NUMERIC NOT NULL,
  payment_status          VARCHAR NOT NULL,
  cancellation_date       TEXT,
  cancellation_reason     VARCHAR,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (villa_id) REFERENCES villas(villa_id),
  FOREIGN KEY (guest_user_id) REFERENCES users(user_id),
  FOREIGN KEY (host_user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS booking_histories (
  booking_history_id      VARCHAR PRIMARY KEY,
  booking_id              VARCHAR NOT NULL,
  action                  VARCHAR NOT NULL,
  previous_value          TEXT,
  new_value               TEXT,
  action_by_user_id       VARCHAR,
  action_at               TEXT NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (action_by_user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS booking_guests (
  booking_guest_id        VARCHAR PRIMARY KEY,
  booking_id              VARCHAR NOT NULL,
  guest_name              VARCHAR NOT NULL,
  guest_email             VARCHAR NOT NULL,
  special_requests        VARCHAR,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

-- BOOKING PAYMENTS (simulated, only for record)
CREATE TABLE IF NOT EXISTS booking_payments (
  booking_payment_id      VARCHAR PRIMARY KEY,
  booking_id              VARCHAR NOT NULL,
  user_id                 VARCHAR NOT NULL,
  amount                  NUMERIC NOT NULL,
  status                  VARCHAR NOT NULL,
  provider                VARCHAR NOT NULL DEFAULT 'simulated',
  processed_at            TEXT,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- MESSAGE THREADS (for grouping messages)
CREATE TABLE IF NOT EXISTS message_threads (
  thread_id               VARCHAR PRIMARY KEY,
  participant_user_id     VARCHAR NOT NULL,
  villa_id                VARCHAR,
  booking_id              VARCHAR,
  last_message_preview    VARCHAR,
  unread_count            INTEGER NOT NULL DEFAULT 0,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (participant_user_id) REFERENCES users(user_id),
  FOREIGN KEY (villa_id) REFERENCES villas(villa_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  message_id              VARCHAR PRIMARY KEY,
  thread_id               VARCHAR NOT NULL,
  sender_user_id          VARCHAR NOT NULL,
  recipient_user_id       VARCHAR NOT NULL,
  content                 TEXT NOT NULL,
  is_read                 BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at                 TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES message_threads(thread_id),
  FOREIGN KEY (sender_user_id) REFERENCES users(user_id),
  FOREIGN KEY (recipient_user_id) REFERENCES users(user_id)
);

-- USER REVIEWS (guest→villa)
CREATE TABLE IF NOT EXISTS user_reviews (
  review_id               VARCHAR PRIMARY KEY,
  booking_id              VARCHAR NOT NULL,
  guest_user_id           VARCHAR NOT NULL,
  villa_id                VARCHAR NOT NULL,
  host_user_id            VARCHAR NOT NULL,
  rating                  INTEGER NOT NULL,
  text                    TEXT,
  is_edited               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (guest_user_id) REFERENCES users(user_id),
  FOREIGN KEY (villa_id) REFERENCES villas(villa_id),
  FOREIGN KEY (host_user_id) REFERENCES users(user_id)
);

-- GUEST REVIEWS (host→guest)
CREATE TABLE IF NOT EXISTS guest_reviews (
  guest_review_id         VARCHAR PRIMARY KEY,
  booking_id              VARCHAR NOT NULL,
  host_user_id            VARCHAR NOT NULL,
  guest_user_id           VARCHAR NOT NULL,
  rating                  INTEGER NOT NULL,
  text                    TEXT,
  is_edited               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (host_user_id) REFERENCES users(user_id),
  FOREIGN KEY (guest_user_id) REFERENCES users(user_id)
);

-- SUPERHOST HISTORY
CREATE TABLE IF NOT EXISTS superhost_history (
  superhost_history_id    VARCHAR PRIMARY KEY,
  host_user_id            VARCHAR NOT NULL,
  is_superhost            BOOLEAN NOT NULL,
  qualifying_reviews      INTEGER NOT NULL,
  qualifying_avg_rating   NUMERIC NOT NULL,
  became_superhost_at     TEXT,
  removed_superhost_at    TEXT,
  FOREIGN KEY (host_user_id) REFERENCES users(user_id)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  notification_id         VARCHAR PRIMARY KEY,
  user_id                 VARCHAR NOT NULL,
  type                    VARCHAR NOT NULL,
  message                 VARCHAR NOT NULL,
  is_read                 BOOLEAN NOT NULL DEFAULT FALSE,
  reference_id            VARCHAR,
  created_at              TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- PASSWORD RESETS
CREATE TABLE IF NOT EXISTS password_resets (
  password_reset_id       VARCHAR PRIMARY KEY,
  user_id                 VARCHAR NOT NULL,
  reset_code              VARCHAR NOT NULL,
  expires_at              TEXT NOT NULL,
  used                    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);



-- ======================================================================
-- SEED DATA FOR DEMO/DEVELOPMENT
-- ======================================================================

--
-- USERS
--
INSERT INTO users (user_id, email, password_hash, display_name, profile_photo_url, bio, contact_email, is_host, is_superhost, last_active_at, created_at, updated_at)
VALUES
('u_guest1', 'guest1@beachstay.com', 'hashed_pass1', 'Alice Guest', 'https://picsum.photos/seed/u_g1/200', 'I love the ocean and discovering new shores.', 'guest1@beachstay.com', FALSE, FALSE, '2024-06-01T11:22:00Z', '2024-05-10T09:00:00Z', '2024-06-01T11:22:01Z'),
('u_host1',  'host1@beachstay.com',  'hashed_pass2', 'Bob Host', 'https://picsum.photos/seed/u_h1/200', 'Host, surfer, sunshine lover.', 'host1@beachstay.com', TRUE, TRUE, '2024-06-01T12:05:00Z', '2024-02-10T14:22:00Z', '2024-06-01T12:05:01Z'),
('u_both1',  'hybrid@beachstay.com', 'hashed_pass3', 'Chris Hybrid', 'https://picsum.photos/seed/u_b1/200', 'Can host or travel!', 'hybrid@beachstay.com', TRUE, FALSE, '2024-05-20T17:45:00Z', '2024-03-12T11:20:00Z', '2024-05-20T17:45:01Z'),
('u_guest2', 'guest2@beachstay.com', 'hashed_pass4', 'Diana Adventurer', 'https://picsum.photos/seed/u_g2/200', 'Swims every day', 'guest2@beachstay.com', FALSE, FALSE, '2024-06-01T13:00:00Z', '2024-04-01T13:00:00Z', '2024-06-01T13:01:00Z'),
('u_host2',  'host2@beachstay.com',  'hashed_pass5', 'Erik Host', 'https://picsum.photos/seed/u_h2/200', 'Cozy cottages for world explorers.', 'host2@beachstay.com', TRUE, FALSE, '2024-06-01T12:45:00Z', '2024-03-22T09:30:00Z', '2024-06-01T12:45:30Z');

--
-- AMENITIES MASTER
--
INSERT INTO amenities (amenity_id, label, icon_url, created_at)
VALUES
(1, 'WiFi', 'https://picsum.photos/seed/a_wifi/50', '2024-03-01T00:00:00Z'),
(2, 'Air Conditioning', 'https://picsum.photos/seed/a_ac/50', '2024-03-01T00:00:00Z'),
(3, 'Private Pool', 'https://picsum.photos/seed/a_pool/50', '2024-03-01T00:00:00Z'),
(4, 'Beach Access', 'https://picsum.photos/seed/a_beach/50', '2024-03-01T00:00:00Z'),
(5, 'Pet Friendly', 'https://picsum.photos/seed/a_pets/50', '2024-03-01T00:00:00Z'),
(6, 'BBQ Grill', 'https://picsum.photos/seed/a_bbq/50', '2024-03-01T00:00:00Z'),
(7, 'Smart TV', 'https://picsum.photos/seed/a_tv/50', '2024-03-01T00:00:00Z'),
(8, 'Parking', 'https://picsum.photos/seed/a_parking/50', '2024-03-01T00:00:00Z'),
(9, 'Laundry', 'https://picsum.photos/seed/a_laundry/50', '2024-03-01T00:00:00Z'),
(10, 'Hot Tub', 'https://picsum.photos/seed/a_hottub/50', '2024-03-01T00:00:00Z');

--
-- VILLAS
--
INSERT INTO villas (villa_id, owner_user_id, title, description_short, description_long, address_street, address_city, address_area, address_postal_code, address_country, latitude, longitude, main_photo_url, cancellation_policy, min_nights, max_nights, bedrooms, beds, bathrooms, max_guests, price_per_night, cleaning_fee, service_fee, taxes, is_active, is_beachfront, is_pet_friendly, is_instant_book, house_rules, published_at, created_at, updated_at)
VALUES
('v_001', 'u_host1', 'Casa del Mar', 'Cozy oceanfront villa for families and groups.', 'Spacious, sunny, direct access to private beach. Fully equipped kitchen, WiFi, BBQ, pool.', '123 Ocean Dr', 'Santa Monica', 'Beachside', '90401', 'US', 34.0195, -118.4912, 'https://picsum.photos/seed/v_001main/800', 'flexible', 2, 21, 4, 6, 3, 10, 420, 60, 45, 36, TRUE, TRUE, TRUE, TRUE, 'No smoking indoors. Quiet hours 11pm-7am. Pets OK.', '2024-05-15T10:00:00Z', '2024-04-12T12:00:00Z', '2024-06-01T10:35:00Z'),
('v_002', 'u_host2', 'Surfside Cottage', 'Bright cottage for couples & solo travelers.', 'Steps from world-class surfing beaches, modern amenities, shaded terrace, AC, smart TV.', '417 Seacliff Rd', 'Malibu', 'Surf Cove', '90265', 'US', 34.0356, -118.6870, 'https://picsum.photos/seed/v_002main/800', 'moderate', 3, 14, 2, 3, 2, 6, 265, 40, 25, 18, TRUE, TRUE, FALSE, FALSE, 'No parties. No pets, sorry.', '2024-05-22T11:00:00Z', '2024-04-22T12:00:00Z', '2024-06-01T10:40:00Z'),
('v_003', 'u_both1', 'Lagoon Hideaway', 'Tropical themed private villa by the inlet.', 'Relax with direct lagoon access, private dock, kayaks included, hot tub, BBQ grill.', '31 Coral Way', 'Key Largo', 'Lagoon', '33037', 'US', 25.1121, -80.4124, 'https://picsum.photos/seed/v_003main/800', 'strict', 3, 30, 5, 9, 4, 14, 670, 120, 77, 58, TRUE, FALSE, TRUE, FALSE, 'No events. No outside guests after 10 pm.', '2024-05-30T13:00:00Z', '2024-05-12T16:00:00Z', '2024-06-01T11:01:00Z');

--
-- VILLA_PHOTOS
--
INSERT INTO villa_photos (villa_photo_id, villa_id, photo_url, ordering, is_main, uploaded_at)
VALUES
('vp_001', 'v_001', 'https://picsum.photos/seed/v_001_1/800', 1, TRUE, '2024-05-15T10:01:00Z'),
('vp_002', 'v_001', 'https://picsum.photos/seed/v_001_2/800', 2, FALSE, '2024-05-15T10:02:00Z'),
('vp_003', 'v_001', 'https://picsum.photos/seed/v_001_3/800', 3, FALSE, '2024-05-15T10:03:00Z'),
('vp_004', 'v_002', 'https://picsum.photos/seed/v_002_1/800', 1, TRUE, '2024-05-22T11:00:00Z'),
('vp_005', 'v_002', 'https://picsum.photos/seed/v_002_2/800', 2, FALSE, '2024-05-22T11:01:00Z'),
('vp_006', 'v_003', 'https://picsum.photos/seed/v_003_1/800', 1, TRUE, '2024-05-30T13:00:00Z');

--
-- VILLA_AMENITIES (selected for each villa)
--
-- Casa del Mar
INSERT INTO villa_amenities (villa_amenity_id, villa_id, amenity_id) VALUES
('va_001', 'v_001', 1), ('va_002', 'v_001', 2), ('va_003', 'v_001', 3), ('va_004', 'v_001', 4), ('va_005', 'v_001', 5), ('va_006', 'v_001', 6), ('va_007', 'v_001', 7), ('va_008', 'v_001', 8);
-- Surfside Cottage
INSERT INTO villa_amenities (villa_amenity_id, villa_id, amenity_id) VALUES
('va_009', 'v_002', 1), ('va_010', 'v_002', 2), ('va_011', 'v_002', 4), ('va_012', 'v_002', 7), ('va_013', 'v_002', 8), ('va_014', 'v_002', 9);
-- Lagoon Hideaway
INSERT INTO villa_amenities (villa_amenity_id, villa_id, amenity_id) VALUES
('va_015', 'v_003', 1), ('va_016', 'v_003', 3), ('va_017', 'v_003', 4), ('va_018', 'v_003', 5), ('va_019', 'v_003', 6), ('va_020', 'v_003', 9), ('va_021', 'v_003', 10);

--
-- VILLA_RULES
--
INSERT INTO villa_rules (villa_rule_id, villa_id, rule_type, allowed, notes)
VALUES
('vr_001', 'v_001', 'smoking', FALSE, 'No smoking indoors.'),
('vr_002', 'v_001', 'pets', TRUE, 'Well-behaved pets permitted.'),
('vr_003', 'v_002', 'parties', FALSE, 'Please respect neighbors!'),
('vr_004', 'v_002', 'pets', FALSE, 'Sorry, not pet-friendly.'),
('vr_005', 'v_003', 'events', FALSE, 'No large events.'),
('vr_006', 'v_003', 'noise', FALSE, 'Quiet after 10pm.');

--
-- VILLA_CALENDAR
--
INSERT INTO villa_calendar (villa_calendar_id, villa_id, date, is_available, reason, updated_at)
VALUES
('vc_001', 'v_001', '2024-06-15', TRUE, NULL, '2024-06-01T10:00:00Z'),
('vc_002', 'v_001', '2024-06-16', FALSE, 'host_blocked', '2024-06-01T12:00:00Z'),
('vc_003', 'v_001', '2024-06-17', TRUE, NULL, '2024-06-01T10:00:00Z'),
('vc_004', 'v_002', '2024-06-15', TRUE, NULL, '2024-06-01T11:00:00Z'),
('vc_005', 'v_002', '2024-06-16', TRUE, NULL, '2024-06-01T11:01:00Z'),
('vc_006', 'v_003', '2024-06-16', FALSE, 'maintenance', '2024-06-01T10:23:00Z');

--
-- VILLA_PRICING_OVERRIDES
--
INSERT INTO villa_pricing_overrides (villa_pricing_override_id, villa_id, date, nightly_price, min_nights, max_nights, updated_at) VALUES
('vpo_001', 'v_001', '2024-07-04', 550, 3, 7, '2024-05-20T10:30:00Z'),
('vpo_002', 'v_002', '2024-07-04', 350, NULL, NULL, '2024-05-20T10:31:00Z'),
('vpo_003', 'v_003', '2024-07-04', 799, 4, 15, '2024-05-21T11:00:00Z');

--
-- VILLA_WISHLISTS & ITEMS
--
INSERT INTO villa_wishlists (wishlist_id, user_id, name, is_deleted, created_at, updated_at)
VALUES
('wl_001', 'u_guest1', 'My Dream Villas', FALSE, '2024-06-01T12:14:00Z', '2024-06-01T12:14:00Z'),
('wl_002', 'u_guest2', 'Surf Escapes', FALSE, '2024-06-01T12:21:00Z', '2024-06-01T12:21:01Z');

INSERT INTO wishlist_items (wishlist_item_id, wishlist_id, villa_id, added_at)
VALUES
('wli_001', 'wl_001', 'v_001', '2024-06-01T12:15:00Z'),
('wli_002', 'wl_001', 'v_003', '2024-06-01T12:16:00Z'),
('wli_003', 'wl_002', 'v_002', '2024-06-01T12:23:00Z');

--
-- BOOKINGS
--
INSERT INTO bookings (booking_id, villa_id, guest_user_id, host_user_id, checkin_date, checkout_date, num_guests, status, is_instant_book, nightly_price, cleaning_fee, service_fee, taxes, total_price, payment_status, cancellation_date, cancellation_reason, created_at, updated_at)
VALUES
('b_001', 'v_001', 'u_guest1', 'u_host1', '2024-06-18', '2024-06-22', 2, 'confirmed', TRUE, 420, 60, 45, 36, 1921, 'paid', NULL, NULL, '2024-05-28T11:50:00Z', '2024-05-31T12:00:00Z'),
('b_002', 'v_002', 'u_guest2', 'u_host2', '2024-07-01', '2024-07-07', 3, 'pending', FALSE, 265, 40, 25, 18, 1748, 'pending', NULL, NULL, '2024-05-29T12:50:00Z', '2024-06-01T10:02:00Z'),
('b_003', 'v_003', 'u_both1', 'u_both1', '2024-07-04', '2024-07-10', 6, 'requested', FALSE, 799, 120, 77, 58, 5269, 'pending', NULL, NULL, '2024-05-30T12:50:00Z', '2024-06-01T10:02:00Z');

--
-- BOOKING HISTORIES
--
INSERT INTO booking_histories (booking_history_id, booking_id, action, previous_value, new_value, action_by_user_id, action_at)
VALUES
('bh_001', 'b_001', 'requested', NULL, '{"status":"requested"}', 'u_guest1', '2024-05-28T11:50:00Z'),
('bh_002', 'b_001', 'confirmed', '{"status":"requested"}', '{"status":"confirmed"}', 'u_host1', '2024-05-29T09:05:00Z'),
('bh_003', 'b_002', 'requested', NULL, '{"status":"requested"}', 'u_guest2', '2024-05-29T12:50:00Z');

--
-- BOOKING GUESTS
--
INSERT INTO booking_guests (booking_guest_id, booking_id, guest_name, guest_email, special_requests)
VALUES
('bg_001', 'b_001', 'Alice Guest', 'guest1@beachstay.com', NULL),
('bg_002', 'b_001', 'John Smith', 'jsmith@example.com', 'Ocean view room if available'),
('bg_003', 'b_002', 'Diana Adventurer', 'guest2@beachstay.com', 'Surfboard storage please');

--
-- BOOKING PAYMENTS
--
INSERT INTO booking_payments (booking_payment_id, booking_id, user_id, amount, status, provider, processed_at)
VALUES
('bp_001', 'b_001', 'u_guest1', 1921, 'paid', 'simulated', '2024-06-01T10:05:00Z'),
('bp_002', 'b_002', 'u_guest2', 1748, 'pending', 'simulated', NULL);

--
-- MESSAGE THREADS and MESSAGES
--
INSERT INTO message_threads (thread_id, participant_user_id, villa_id, booking_id, last_message_preview, unread_count, updated_at)
VALUES
('mt_001', 'u_guest1', 'v_001', 'b_001', 'Looking forward to my stay!', 0, '2024-06-01T12:00:00Z'),
('mt_002', 'u_guest2', 'v_002', 'b_002', 'Can I check in early?', 1, '2024-06-01T12:03:00Z');

INSERT INTO messages (message_id, thread_id, sender_user_id, recipient_user_id, content, is_read, sent_at)
VALUES
('m_001', 'mt_001', 'u_guest1', 'u_host1', 'Hi Bob, just confirming my booking. Looking forward to my stay!', FALSE, '2024-06-01T11:31:00Z'),
('m_002', 'mt_001', 'u_host1', 'u_guest1', 'You''re all set! Let me know if you have requests.', TRUE, '2024-06-01T11:40:00Z'),
('m_003', 'mt_002', 'u_guest2', 'u_host2', 'Hi, can I check in early?', FALSE, '2024-06-01T12:03:00Z');

--
-- USER REVIEWS
--
INSERT INTO user_reviews (review_id, booking_id, guest_user_id, villa_id, host_user_id, rating, text, is_edited, created_at, updated_at)
VALUES
('ur_001', 'b_001', 'u_guest1', 'v_001', 'u_host1', 5, 'Amazing stay! Clean, spacious, right on the beach. Will be back!', FALSE, '2024-06-01T12:05:00Z', '2024-06-01T12:05:00Z'),
('ur_002', 'b_002', 'u_guest2', 'v_002', 'u_host2', 4, 'Cottage is cute with great location, WiFi a bit slow but awesome waves!', FALSE, '2024-06-01T12:10:00Z', '2024-06-01T12:10:00Z');

--
-- GUEST REVIEWS
--
INSERT INTO guest_reviews (guest_review_id, booking_id, host_user_id, guest_user_id, rating, text, is_edited, created_at, updated_at)
VALUES
('gr_001', 'b_001', 'u_host1', 'u_guest1', 5, 'Alice was a fantastic guest: punctual, tidy, and communicative!', FALSE, '2024-06-02T14:00:00Z', '2024-06-02T14:00:01Z'),
('gr_002', 'b_002', 'u_host2', 'u_guest2', 4, 'Diana and friends were polite, all house rules respected.', FALSE, '2024-06-02T11:20:00Z', '2024-06-02T11:20:01Z');

--
-- SUPERHOST HISTORY
--
INSERT INTO superhost_history (superhost_history_id, host_user_id, is_superhost, qualifying_reviews, qualifying_avg_rating, became_superhost_at, removed_superhost_at)
VALUES
('sh_001', 'u_host1', TRUE, 12, 4.9, '2024-04-01T00:00:00Z', NULL);

--
-- NOTIFICATIONS (partial examples)
--
INSERT INTO notifications (notification_id, user_id, type, message, is_read, reference_id, created_at)
VALUES
('n_001', 'u_guest1', 'booking_confirmed', 'Your booking is confirmed for Casa del Mar!', FALSE, 'b_001', '2024-06-01T12:10:00Z'),
('n_002', 'u_host1', 'booking_confirmed', 'Alice Guest booked your villa: Casa del Mar', TRUE, 'b_001', '2024-06-01T12:10:30Z'),
('n_003', 'u_guest2', 'message_received', 'You have 1 new message from Erik Host', FALSE, 'm_003', '2024-06-01T12:04:00Z');

--
-- PASSWORD RESETS
--
INSERT INTO password_resets (password_reset_id, user_id, reset_code, expires_at, used, created_at)
VALUES
('pr_001', 'u_guest1', 'RESETCODE101', '2024-07-01T00:00:00Z', FALSE, '2024-06-01T17:00:00Z'),
('pr_002', 'u_host2', 'RESETCODE202', '2024-07-02T00:00:00Z', TRUE, '2024-06-01T18:01:30Z');

-- END OF INITIAL SEED DATA
-- BeachStay Villas: Ready for production!