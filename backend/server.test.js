import request from 'supertest';
import { app, pool } from './server.ts'; // Your main express app and DB pool
import jwt from 'jsonwebtoken';

// ----- HELPERS -----

// Create helpers for JWT signing to simulate regular/host users
const JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
const createJwt = (uid, isHost = false, isSuperhost = false) =>
  jwt.sign(
    { user_id: uid, is_host: isHost, is_superhost: isSuperhost },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

// Helper: Start DB test transactions and rollback for each test
beforeAll(async () => {
  await pool.query('BEGIN');
});
afterAll(async () => {
  await pool.query('ROLLBACK');
  await pool.end();
});

// For strong isolation
beforeEach(async () => {
  await pool.query('SAVEPOINT test_savepoint');
});
afterEach(async () => {
  await pool.query('ROLLBACK TO SAVEPOINT test_savepoint');
});

// ==== 1. AUTH & ACCOUNT  ====

describe('Auth', () => {
  test('Signup - success', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({
        email: 'newuser@beachstay.com',
        password: 'SuperSecret123',
        display_name: 'Test User'
      });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user_id).toBeDefined();
  });

  test('Signup - duplicate email fails', async () => {
    await request(app).post('/auth/signup').send({
      email: 'unique@beachstay.com', password: 'UniquePwd12', display_name: 'Unique'
    });
    const res2 = await request(app).post('/auth/signup').send({
      email: 'unique@beachstay.com', password: 'UniquePwd21', display_name: 'Other'
    });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toMatch(/already exists|unique/i);
  });

  test('Login - success', async () => {
    // The user 'guest1@beachstay.com' is seeded in DB with password 'any' (simulate correct hash or replace for test)
    // You may need to mock or adjust hashing for testing
    // For now, assume passport/local strategy accepts test hash
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'guest1@beachstay.com', password: 'hashed_pass1' }); // adapt as per real password logic!
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('Login - invalid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'guest1@beachstay.com', password: 'wrong_pass' });
    expect([400, 401]).toContain(res.status);
    expect(res.body.error).toMatch(/invalid/i);
  });

  test('Password reset request - success', async () => {
    const res = await request(app)
      .post('/auth/password/request-reset')
      .send({ email: 'guest1@beachstay.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/requested/i);
    // Verify password_resets row was created in DB
    const dbRes = await pool.query(
      `SELECT * FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, ['u_guest1']
    );
    expect(dbRes.rows.length).toBeGreaterThan(0);
  });

  test('Password reset submit - valid/invalid code', async () => {
    // Happy path: Use known reset_code from seed data
    let res = await request(app)
      .post('/auth/password/reset')
      .send({ reset_code: 'RESETCODE101', new_password: 'AWholeNewPW111' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset/i);

    // Used/invalid code
    res = await request(app)
      .post('/auth/password/reset')
      .send({ reset_code: 'RESETCODE202', new_password: 'AnotherPW222' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid|used|expired/i);
  });
});

describe('Account', () => {
  const guestJwt = createJwt('u_guest1');
  test('Get my profile (authenticated)', async () => {
    const res = await request(app)
      .get('/account/me')
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe('u_guest1');
    expect(res.body.email).toMatch(/guest/);
  });

  test('Update my profile (display_name, bio)', async () => {
    const res = await request(app)
      .patch('/account/me')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ display_name: 'TestChanged', bio: 'New bio for testing' });
    expect(res.status).toBe(200);
    expect(res.body.display_name).toBe('TestChanged');
    expect(res.body.bio).toBe('New bio for testing');
  });

  test('Profile update fails for invalid fields', async () => {
    const res = await request(app)
      .patch('/account/me')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ display_name: '', contact_email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });
});

// ==== 2. VILLAS: PUBLIC & HOST CRUD ====

describe('Villas', () => {
  test('Search villas (city filter, basic structure)', async () => {
    const res = await request(app)
      .get('/villas?location=Santa Monica&num_guests=2');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0]).toHaveProperty('villa_id');
    expect(res.body.results[0]).toHaveProperty('address_city', 'Santa Monica');
  });

  test('Get villa details', async () => {
    const res = await request(app)
      .get('/villa/v_001');
    expect(res.status).toBe(200);
    expect(res.body.villa_id).toBe('v_001');
    expect(res.body.title).toMatch(/Casa del Mar/);
  });

  test('Get villa amenities/rules/photos', async () => {
    for (const sub of ['amenities', 'photos', 'rules']) {
      const res = await request(app)
        .get(`/villa/v_001/${sub}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    }
  });

  test('Villa calendar - get', async () => {
    const res = await request(app)
      .get('/villa/v_001/calendar');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(d => d.date === '2024-06-16')).toBe(true);
  });

  test('Amenities master - get', async () => {
    const res = await request(app)
      .get('/villas/amenities');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('amenity_id');
    expect(res.body[0]).toHaveProperty('label');
  });

  describe('Host CRUD', () => {
    const hostJwt = createJwt('u_host1', true, true);

    test('Host POST new villa', async () => {
      const body = {
        villa_id: 'v_100',
        owner_user_id: 'u_host1',
        title: "Test Beach Villa",
        description_short: "Short descrip",
        description_long: "Long description here",
        address_street: "1 Beach Rd",
        address_city: "Bondi",
        address_country: "AU",
        latitude: -33.889,
        longitude: 151.275,
        cancellation_policy: "flexible",
        min_nights: 2,
        max_nights: 14,
        bedrooms: 2,
        beds: 4,
        bathrooms: 1,
        max_guests: 4,
        price_per_night: 400,
        cleaning_fee: 50,
        service_fee: 20,
        taxes: 10,
        is_active: true,
        is_beachfront: true,
        is_pet_friendly: false,
        is_instant_book: true,
        house_rules: "No parties.",
        published_at: "2024-06-05T10:00:00Z"
      };
      const res = await request(app)
        .post('/host/villas')
        .set('Authorization', `Bearer ${hostJwt}`)
        .send(body);
      expect(res.status).toBe(200);
      expect(res.body.villa_id).toBe('v_100');
      expect(res.body.title).toBe('Test Beach Villa');

      // Created villa should be findable via /villas
      const searchRes = await request(app).get('/villas?location=Bondi');
      expect(searchRes.body.results.some(v => v.villa_id === 'v_100')).toBe(true);
    });

    test('Host PATCH existing villa (partial update)', async () => {
      const res = await request(app)
        .patch('/villa/v_001')
        .set('Authorization', `Bearer ${hostJwt}`)
        .send({ title: "Updated Casa del Mar", is_active: false });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Casa del Mar');
      expect(res.body.is_active).toBe(false);
    });

    test('Villa PATCH fails for non-owner', async () => {
      const evilJwt = createJwt('u_guest1');
      const res = await request(app)
        .patch('/villa/v_001')
        .set('Authorization', `Bearer ${evilJwt}`)
        .send({ title: 'Should not work' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden|not owner/i);
    });
  });
});

// ==== 3. BOOKINGS ====

describe('Bookings and Reservations', () => {
  const guestJwt = createJwt('u_guest1');
  const hostJwt = createJwt('u_host1', true, true);

  test('Booking preview: success and blocked date', async () => {
    // Open date: 2024-06-17 on v_001
    let res = await request(app)
      .post('/villas/v_001/booking/preview')
      .send({ checkin_date: '2024-06-17', checkout_date: '2024-06-19', num_guests: 2 });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.price_summary.total_price).toBeGreaterThan(0);

    // Blocked date: 2024-06-16 unavailable
    res = await request(app)
      .post('/villas/v_001/booking/preview')
      .send({ checkin_date: '2024-06-16', checkout_date: '2024-06-18', num_guests: 2 });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  test('POST booking - success / POST booking - double booking fails', async () => {
    // Should succeed on open date
    const body = {
      villa_id: 'v_001',
      checkin_date: '2024-08-01',
      checkout_date: '2024-08-04',
      num_guests: 2,
      guest_details: {
        name: 'Integration Guest',
        email: 'itest@guest.com',
        special_requests: null
      }
    };
    const res = await request(app)
      .post('/villas/v_001/booking')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.villa_id).toBe('v_001');
    expect(res.body.status).toMatch(/requested|pending|confirmed/);

    // Try to double-book (should fail: date locked in above)
    // Assumes backend enforces overlap! Existing booking for 2024-07-04 to 2024-07-10 on v_003
    const res2 = await request(app)
      .post('/villas/v_003/booking')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({
        villa_id: 'v_003',
        checkin_date: '2024-07-04',
        checkout_date: '2024-07-07',
        num_guests: 1,
        guest_details: { name: 'Test', email: 't@a.com' }
      });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toMatch(/overlap|unavailable|already booked/i);
  });

  test('Booking GET, PATCH (modification), DELETE (cancel) flow, and authz', async () => {
    // First, create a new test booking as u_guest1, v_002
    const createBody = {
      villa_id: 'v_002',
      checkin_date: '2024-09-01',
      checkout_date: '2024-09-03',
      num_guests: 2,
      guest_details: { name: "Test G", email: "g@a.com" }
    };
    const bookingRes = await request(app)
      .post('/villas/v_002/booking')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send(createBody);
    const bookingId = bookingRes.body.booking_id;

    // GET by booking id
    const getRes = await request(app)
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.booking_id).toBe(bookingId);

    // PATCH - guest can modify dates
    const patchRes = await request(app)
      .patch(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ checkin_date: '2024-09-02', checkout_date: '2024-09-05', num_guests: 3 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.checkin_date).toBe('2024-09-02');
    expect(patchRes.body.num_guests).toBe(3);

    // Host can also PATCH (e.g. modify, approve/reject via /host/reservations/{booking_id}/status)
    const hostPatch = await request(app)
      .patch(`/host/reservations/${bookingId}/status`)
      .set('Authorization', `Bearer ${hostJwt}`)
      .send({ status: 'approved' }); // status enum as per your logic
    expect(hostPatch.status).toBe(200);
    expect(hostPatch.body.status).toMatch(/approved|confirmed/);

    // DELETE - guest cancels
    const delRes = await request(app)
      .delete(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.status).toMatch(/cancelled/);

    // Unauthorized access
    const res3 = await request(app)
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${createJwt('u_guest2')}`); // another user
    expect(res3.status).toBe(403);
  });
});

// ==== 4. WISHLISTS ====

describe('Wishlists', () => {
  const guestJwt = createJwt('u_guest1');

  test('List wishlists, create wishlist, edit/delete, add/remove villa', async () => {
    // List
    let res = await request(app)
      .get('/account/wishlists')
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Create
    res = await request(app)
      .post('/account/wishlists')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ name: 'Test Wishlist' });
    expect(res.status).toBe(200);
    const wid = res.body.wishlist_id;

    // Update name
    res = await request(app)
      .patch(`/account/wishlists/${wid}`)
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ name: 'Updated List Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated List Name');

    // Add villa to wishlist
    res = await request(app)
      .put(`/account/wishlists/${wid}/villas/v_002`)
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.villa_ids).toContain('v_002');

    // Remove villa
    res = await request(app)
      .delete(`/account/wishlists/${wid}/villas/v_002`)
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.villa_ids).not.toContain('v_002');

    // Delete wishlist
    res = await request(app)
      .delete(`/account/wishlists/${wid}`)
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.is_deleted).toBe(true);
  });
});

// ==== 5. MESSAGING & INBOX ====

describe('Messaging', () => {
  const guestJwt = createJwt('u_guest1');
  const hostJwt = createJwt('u_host1', true);

  test('List and fetch threads, send/retrieve message', async () => {
    // Inbox
    let res = await request(app)
      .get('/inbox')
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Fetch messages in existing thread
    res = await request(app)
      .get('/inbox/mt_001')
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Send message in thread
    res = await request(app)
      .post('/inbox/mt_001')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ content: "Test message from user" });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Test message from user");
  });

  test('Contact host (pre-book inquiry)', async () => {
    const res = await request(app)
      .post('/villa/v_002/contact-host')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ content: "Is wifi fast?" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('thread_id');
    expect(res.body.last_message_preview).toMatch(/wifi/i);
  });

  // Optionally, for websocket: Use socket.io-client to emit/receive events for "message_new"
  // Not shown for brevity, but production-quality test would establish ws conn, send, expect correct payload in event
});

// ==== 6. REVIEWS ====

describe('Reviews', () => {
  const guestJwt = createJwt('u_guest1');
  const hostJwt = createJwt('u_host1', true);

  test('List villa reviews (public), leave review, edit/delete, my reviews', async () => {
    // List
    let res = await request(app)
      .get('/villas/v_001/reviews');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reviews)).toBe(true);

    // Leave review after stay (must be party to completed booking); b_001 is u_guest1
    res = await request(app)
      .post('/booking/b_001/review')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ booking_id: 'b_001', rating: 5, text: "Perfect stay!" });
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(5);

    // Edit within window
    const reviewId = res.body.review_id;
    res = await request(app)
      .patch(`/review/${reviewId}`)
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ text: "Updated review", rating: 4 });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("Updated review");
    expect(res.body.rating).toBe(4);

    // Delete
    res = await request(app)
      .delete(`/review/${reviewId}`)
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);

    // My Reviews
    res = await request(app)
      .get('/account/my_reviews')
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Host reviews guest (and fetches)', async () => {
    // Host can review guest on completed stay, e.g. b_001
    let res = await request(app)
      .post('/booking/b_001/review')
      .set('Authorization', `Bearer ${hostJwt}`)
      .send({ booking_id: 'b_001', rating: 5, text: "Great guest" });
    expect(res.status).toBe(200);

    res = await request(app)
      .get('/host/villas/v_001/guest-reviews')
      .set('Authorization', `Bearer ${hostJwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ==== 7. NOTIFICATIONS, SUPERHOST, STATIC/INFO ====

describe('Notifications', () => {
  const guestJwt = createJwt('u_guest1');
  test('List, unread count, mark read notification', async () => {
    let res = await request(app)
      .get('/account/notifications')
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);

    // Unread count
    res = await request(app)
      .get('/account/notifications/unread_count')
      .set('Authorization', `Bearer ${guestJwt}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.unread_count).toBe('number');

    // Mark read (pick first notification)
    const nid = res.body.items && res.body.items[0] && res.body.items[0].notification_id;
    if (nid) {
      res = await request(app)
        .post(`/account/notifications/${nid}/read`)
        .set('Authorization', `Bearer ${guestJwt}`);
      expect(res.status).toBe(200);
      expect(res.body.is_read).toBe(true);
    }
  });
});

describe('Superhost & Static Endpoints', () => {
  const hostJwt = createJwt('u_host1', true, true);

  test('Superhost status endpoint', async () => {
    const res = await request(app)
      .get('/account/superhost')
      .set('Authorization', `Bearer ${hostJwt}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('is_superhost', true);
  });

  test('Health/info/search suggestions', async () => {
    let res = await request(app)
      .get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');

    res = await request(app).get('/info/terms');
    expect(res.status).toBe(200);

    res = await request(app).get('/search/suggestions?q=Surf');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ===== EDGE CASES AND ERROR HANDLING COVERAGE =====

describe('Edge Cases & Auth Errors', () => {
  test('401 on protected endpoint', async () => {
    const res = await request(app)
      .get('/account/me');
    expect(res.status).toBe(401);
  });
  test('404 on missing villa', async () => {
    const res = await request(app)
      .get('/villa/NO_SUCH_VILLA');
    expect(res.status).toBe(404);
  });
  test('Invalid ID type/format returns 400', async () => {
    const guestJwt = createJwt('u_guest1');
    const res = await request(app)
      .patch('/villa/v_001')
      .set('Authorization', `Bearer ${guestJwt}`)
      .send({ bedrooms: -1 }); // Fails min(1)
    expect(res.status).toBe(400);
  });
});

//
// ======= END OF TEST SUITE =======
// All test DB changes are rolled back after each test via savepoints.
//