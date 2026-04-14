import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from './testDbHelper';
import { createApp } from '../app';
import Plan from '../models/Plan';
import User from '../models/User';
import Session from '../models/Session';
import mongoose from 'mongoose';

const app = createApp();

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function seedPlan(overrides = {}) {
  return await Plan.create({
    name: 'Test Plan',
    price: 3995,
    rounds: 5,
    validityDays: 10,
    perRoundPrice: 799,
    costPerRound: 50,
    profitPerRound: 749,
    ...overrides,
  });
}

async function seedUser(plan: any, overrides = {}) {
  return await User.create({
    email: 'user@test.com',
    mobile: '9876543210',
    licenseKey: 'TESTKEY12345678A',
    planId: plan._id,
    roundsRemaining: 5,
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    ...overrides,
  });
}


async function getAdminToken(): Promise<string> {
  process.env.ADMIN_USER = 'admin';
  process.env.ADMIN_PASS = 'secret';
  const res = await request(app)
    .post('/api/users/login')
    .send({ username: 'admin', password: 'secret' });
  return res.body.token;
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(async () => { await connectTestDB(); });
afterEach(async () => { await clearTestDB(); });
afterAll(async () => { await closeTestDB(); });

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /health', () => {
  it('returns 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PLANS API
// ══════════════════════════════════════════════════════════════════════════════
describe('Plans API', () => {
  it('GET /api/plans — returns empty array initially', async () => {
    const res = await request(app).get('/api/plans');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/plans — 401 without admin token', async () => {
    const res = await request(app)
      .post('/api/plans')
      .send({ name: 'Starter', price: 999, rounds: 1, validityDays: 7 });
    expect(res.status).toBe(401);
  });

  it('GET /api/plans — returns seeded plan', async () => {
    await seedPlan();
    const res = await request(app).get('/api/plans');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Test Plan');
    expect(res.body[0].price).toBe(3995);
    expect(res.body[0].perRoundPrice).toBe(799);
  });

  it('POST /api/plans — 201 creates a plan with admin token', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Pro', price: 4999, rounds: 10, validityDays: 30 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Pro');
    expect(res.body.price).toBe(4999);
    expect(res.body.perRoundPrice).toBeCloseTo(499.9);
    expect(res.body._id).toBeDefined();
  });

  it('POST /api/plans/update — 200 updates plan with admin token', async () => {
    const plan = await seedPlan();
    const token = await getAdminToken();
    const res = await request(app)
      .post('/api/plans/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: plan._id.toString(), price: 1499 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(1499);
  });

  it('POST /api/plans/update — 404 for invalid plan id', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .post('/api/plans/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: new mongoose.Types.ObjectId().toString(), price: 100 });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/plans/:id — 200 deletes plan with admin token', async () => {
    const plan = await seedPlan();
    const token = await getAdminToken();
    const res = await request(app)
      .delete(`/api/plans/${plan._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);
    const check = await request(app).get('/api/plans');
    expect(check.body.length).toBe(0);
  });

  it('DELETE /api/plans/:id — 404 for non-existent plan', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .delete(`/api/plans/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LICENSE API
// ══════════════════════════════════════════════════════════════════════════════
describe('License API', () => {
  it('POST /api/license/validate — 404 for unknown licenseKey', async () => {
    const res = await request(app)
      .post('/api/license/validate')
      .send({ licenseKey: 'NONEXISTENT_KEY' });
    expect(res.status).toBe(404);
    expect(res.body.valid).toBe(false);
  });

  it('POST /api/license/generate — 401 without admin token', async () => {
    const res = await request(app)
      .post('/api/license/generate')
      .send({ email: 'test@test.com', mobile: '9000000001', planId: new mongoose.Types.ObjectId() });
    expect(res.status).toBe(401);
  });

  it('POST /api/license/generate — 201 creates license with valid admin token', async () => {
    const plan = await seedPlan();
    const token = await getAdminToken();
    const res = await request(app)
      .post('/api/license/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'newuser@test.com', mobile: '9111222333', planId: plan._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('licenseKey');
    expect(res.body.roundsRemaining).toBe(5);
    expect(res.body.planName).toBe('Test Plan');
  });

  it('POST /api/license/generate — 400 when mobile is missing', async () => {
    const plan = await seedPlan();
    const token = await getAdminToken();
    const res = await request(app)
      .post('/api/license/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'noback@test.com', planId: plan._id.toString() });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('POST /api/license/validate — valid active license returns correct fields', async () => {
    const plan = await seedPlan();
    await seedUser(plan, { licenseKey: 'VALID_LICENSE_KEY', roundsRemaining: 2 });
    const res = await request(app)
      .post('/api/license/validate')
      .send({ licenseKey: 'VALID_LICENSE_KEY' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.roundsRemaining).toBe(2);
    expect(res.body.planName).toBe('Test Plan');
    expect(res.body.trialAvailable).toBe(true);
  });

  it('POST /api/license/validate — rejects expired license', async () => {
    const plan = await seedPlan();
    await seedUser(plan, {
      licenseKey: 'EXPIRED_LIC_KEY1',
      expiryDate: new Date(Date.now() - 1000 * 60 * 60),
    });
    const res = await request(app)
      .post('/api/license/validate')
      .send({ licenseKey: 'EXPIRED_LIC_KEY1' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('POST /api/license/validate — rejects 0 rounds remaining', async () => {
    const plan = await seedPlan();
    await seedUser(plan, { licenseKey: 'NOROUNDS_KEY123', roundsRemaining: 0 });
    const res = await request(app)
      .post('/api/license/validate')
      .send({ licenseKey: 'NOROUNDS_KEY123' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.message).toMatch(/rounds/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH — OTP FLOW
// ══════════════════════════════════════════════════════════════════════════════
describe('Auth API — OTP flow', () => {
  it('POST /api/auth/request-otp — 400 when mobile is missing', async () => {
    const res = await request(app).post('/api/auth/request-otp').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('POST /api/auth/request-otp — 404 for unregistered mobile', async () => {
    const res = await request(app).post('/api/auth/request-otp').send({ mobile: '9999999999' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('POST /api/auth/request-otp — 200 sets OTP for registered user', async () => {
    const plan = await seedPlan();
    await seedUser(plan);
    const res = await request(app).post('/api/auth/request-otp').send({ mobile: '9876543210' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/sent/i);
    const user = await User.findOne({ mobile: '9876543210' });
    expect(user?.otp).toBeDefined();
    expect(user?.otpExpiry).toBeDefined();
  });

  it('POST /api/auth/verify-otp — 400 when body is incomplete', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9999999999' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/verify-otp — 400 for wrong OTP', async () => {
    const plan = await seedPlan();
    await User.create({
      email: 'otp@test.com', mobile: '9876543210',
      licenseKey: 'ABCD1234EFGH5678', planId: plan._id,
      roundsRemaining: 3, expiryDate: new Date(Date.now() + 864e7),
      otp: '123456', otpExpiry: new Date(Date.now() + 6e5),
    });
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9876543210', otp: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it('POST /api/auth/verify-otp — 200 with correct OTP, returns token, clears OTP', async () => {
    const plan = await seedPlan();
    await User.create({
      email: 'ok@test.com', mobile: '9876543211',
      licenseKey: 'AAAA1111BBBB2222', planId: plan._id,
      roundsRemaining: 3, expiryDate: new Date(Date.now() + 864e7),
      otp: '654321', otpExpiry: new Date(Date.now() + 6e5),
    });
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9876543211', otp: '654321' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.message).toMatch(/success/i);
    const user = await User.findOne({ mobile: '9876543211' });
    expect(user?.otp).toBeUndefined();
    expect(user?.otpExpiry).toBeUndefined();
  });

  it('POST /api/auth/verify-otp — 400 for expired OTP', async () => {
    const plan = await seedPlan();
    await User.create({
      email: 'exp@test.com', mobile: '9000000000',
      licenseKey: 'XXXX9999YYYY8888', planId: plan._id,
      roundsRemaining: 1, expiryDate: new Date(Date.now() + 864e7),
      otp: '111111', otpExpiry: new Date(Date.now() - 1000),
    });
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9000000000', otp: '111111' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT API
// ══════════════════════════════════════════════════════════════════════════════
describe('Payment API', () => {
  it('POST /api/payments/create-order — 404 for invalid planId', async () => {
    const res = await request(app)
      .post('/api/payments/create-order')
      .send({ planId: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Plan not found');
  });

  it('POST /api/payments/verify-payment — 400 for invalid HMAC signature', async () => {
    const plan = await seedPlan();
    const res = await request(app)
      .post('/api/payments/verify-payment')
      .send({
        razorpay_order_id: 'order_fake123',
        razorpay_payment_id: 'pay_fake456',
        razorpay_signature: 'badsignature',
        email: 'pay@test.com',
        mobile: '9111111111',
        planId: plan._id.toString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not legit/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// USER ADMIN API
// ══════════════════════════════════════════════════════════════════════════════
describe('Users Admin API', () => {
  it('POST /api/users/login — 401 for wrong credentials', async () => {
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASS = 'secret';
    const res = await request(app)
      .post('/api/users/login')
      .send({ username: 'admin', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('POST /api/users/login — 200 with correct credentials, returns token', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ username: 'admin', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('GET /api/users — 401 without auth token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('GET /api/users — 200 with valid admin token', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/users — returns seeded users', async () => {
    const plan = await seedPlan();
    await seedUser(plan);
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].email).toBe('user@test.com');
  });

  it('PUT /api/users/:id/deactivate — 200 sets rounds=0, license becomes invalid', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { roundsRemaining: 5 });
    const token = await getAdminToken();
    const res = await request(app)
      .put(`/api/users/${user._id}/deactivate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.roundsRemaining).toBe(0);
    const validate = await request(app)
      .post('/api/license/validate')
      .send({ licenseKey: user.licenseKey });
    expect(validate.body.valid).toBe(false);
  });

  it('PUT /api/users/:id/deactivate — 404 for unknown user', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .put(`/api/users/${new mongoose.Types.ObjectId()}/deactivate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('PUT /api/users/:id/extend — 200 extends expiry by N days', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan);
    const token = await getAdminToken();
    const before = new Date(user.expiryDate).getTime();
    const res = await request(app)
      .put(`/api/users/${user._id}/extend`)
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 30 });
    expect(res.status).toBe(200);
    const after = new Date(res.body.user.expiryDate).getTime();
    const diffDays = Math.round((after - before) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  it('PUT /api/users/:id/extend — 404 for unknown user', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .put(`/api/users/${new mongoose.Types.ObjectId()}/extend`)
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 30 });
    expect(res.status).toBe(404);
  });

  it('PUT /api/users/:id/add-rounds — 200 correctly adds rounds to existing total', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { roundsRemaining: 2 });
    const token = await getAdminToken();
    const res = await request(app)
      .put(`/api/users/${user._id}/add-rounds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rounds: 5 });
    expect(res.status).toBe(200);
    expect(res.body.user.roundsRemaining).toBe(7);
  });

  it('PUT /api/users/:id/add-rounds — 404 for unknown user', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .put(`/api/users/${new mongoose.Types.ObjectId()}/add-rounds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rounds: 3 });
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SESSION API
// ══════════════════════════════════════════════════════════════════════════════
describe('Session API', () => {
  it('POST /api/session/start — 404 for invalid licenseKey', async () => {
    const res = await request(app)
      .post('/api/session/start')
      .send({ licenseKey: 'INVALID_LIC_KEY0' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/invalid license/i);
  });

  it('POST /api/session/start — 400 when no rounds remaining', async () => {
    const plan = await seedPlan();
    await seedUser(plan, { licenseKey: 'NOROUNDS_LIC001', roundsRemaining: 0 });
    const res = await request(app)
      .post('/api/session/start')
      .send({ licenseKey: 'NOROUNDS_LIC001' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rounds/i);
  });

  it('POST /api/session/start — 400 when license is expired', async () => {
    const plan = await seedPlan();
    await seedUser(plan, {
      licenseKey: 'EXPIRED_LIC_SES1',
      expiryDate: new Date(Date.now() - 1000 * 60 * 60),
    });
    const res = await request(app)
      .post('/api/session/start')
      .send({ licenseKey: 'EXPIRED_LIC_SES1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('POST /api/session/start — 201 creates session, does NOT deduct round', async () => {
    const plan = await seedPlan();
    await seedUser(plan, { licenseKey: 'VALID_LIC_SESS01' });
    const res = await request(app)
      .post('/api/session/start')
      .send({ licenseKey: 'VALID_LIC_SESS01' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.roundsRemaining).toBe(5);
  });

  it('POST /api/session/end — 404 for unknown sessionId', async () => {
    const res = await request(app)
      .post('/api/session/end')
      .send({ sessionId: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('POST /api/session/end — short session (<9 min): round NOT deducted', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'END_TEST_LIC001' });
    const session = await Session.create({
      userId: user._id, planId: plan._id,
      sessionType: 'paid',
      startTime: new Date(),
    });
    const res = await request(app)
      .post('/api/session/end')
      .send({ sessionId: session._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.session.countedAsRound).toBe(false);
    const updated = await User.findById(user._id);
    expect(updated?.roundsRemaining).toBe(5);
  });

  it('POST /api/session/end — long session (>9 min): round IS deducted', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'LONG_LIC_TEST01', roundsRemaining: 3 });
    const session = await Session.create({
      userId: user._id, planId: plan._id,
      sessionType: 'paid',
      startTime: new Date(Date.now() - 15 * 60 * 1000),
    });
    const res = await request(app)
      .post('/api/session/end')
      .send({ sessionId: session._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.session.countedAsRound).toBe(true);
    const updated = await User.findById(user._id);
    expect(updated?.roundsRemaining).toBe(2);
  });

  it('POST /api/session/update — 404 for unknown sessionId', async () => {
    const res = await request(app)
      .post('/api/session/update')
      .send({ sessionId: new mongoose.Types.ObjectId().toString(), tokensUsed: 100 });
    expect(res.status).toBe(404);
  });

  it('POST /api/session/update — 200 accumulates tokens, cost, and usage minutes', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'UPDATE_LIC_001' });
    const session = await Session.create({
      userId: user._id, planId: plan._id, startTime: new Date(),
    });
    const res = await request(app)
      .post('/api/session/update')
      .send({ sessionId: session._id.toString(), tokensUsed: 500, aiCost: 0.005, usageMinutes: 2 });
    expect(res.status).toBe(200);
    expect(res.body.session.tokensUsed).toBe(500);
    expect(res.body.session.aiCost).toBeCloseTo(0.005);
    const updated = await User.findById(user._id);
    expect(updated?.totalTokensUsed).toBe(500);
    expect(updated?.usageMinutes).toBe(2);
  });

  it('POST /api/usage (alias) — 200 accumulates usage', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'ALIAS_LIC_0001' });
    const session = await Session.create({ userId: user._id, planId: plan._id, startTime: new Date() });
    const res = await request(app)
      .post('/api/usage')
      .send({ sessionId: session._id.toString(), tokensUsed: 200, aiCost: 0.002 });
    expect(res.status).toBe(200);
    expect(res.body.session.tokensUsed).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS API
// ══════════════════════════════════════════════════════════════════════════════
describe('Analytics API', () => {
  it('GET /api/analytics/dashboard — 200 returns empty-state stats', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBe(0);
    expect(res.body.activeLicenses).toBe(0);
    expect(res.body.totalRevenue).toBe(0);
    expect(res.body.totalAICost).toBe(0);
    expect(res.body.totalTokens).toBe(0);
  });

  it('GET /api/analytics/dashboard — 401 without admin token', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/dashboard — correctly counts active vs total users', async () => {
    const plan = await seedPlan();
    await seedUser(plan, {
      email: 'active@test.com', mobile: '9111111110',
      licenseKey: 'ACTIVE_KEY_001', roundsRemaining: 2,
    });
    await seedUser(plan, {
      email: 'inactive@test.com', mobile: '9111111111',
      licenseKey: 'INACTIVE_KEY01', roundsRemaining: 0,
      expiryDate: new Date(Date.now() - 1000),
    });
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBe(2);
    expect(res.body.activeLicenses).toBe(1);
  });

  it('GET /api/analytics/cost — 200 returns zero stats on empty DB', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/analytics/cost')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.avgCost).toBe(0);
    expect(res.body.totalCost).toBe(0);
    expect(res.body.count).toBe(0);
  });

  it('GET /api/analytics/cost — aggregates real session data correctly', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'ANALYTICS_LIC1' });
    await Session.create([
      { userId: user._id, planId: plan._id, sessionType: 'paid', startTime: new Date(), aiCost: 0.01, tokensUsed: 100, durationMinutes: 15, countedAsRound: true },
      { userId: user._id, planId: plan._id, sessionType: 'paid', startTime: new Date(), aiCost: 0.02, tokensUsed: 200, durationMinutes: 20, countedAsRound: true },
    ]);
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/analytics/cost')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.totalCost).toBeCloseTo(0.03);
    expect(res.body.avgCost).toBeCloseTo(0.015);
  });

  it('GET /api/analytics/profit — 200 returns profit stats', async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/analytics/profit')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profitPerRound');
    expect(res.body).toHaveProperty('avgRevenuePerRound');
    expect(res.body).toHaveProperty('avgCostPerRound');
  });

  it('GET /api/analytics/active-users — 200 returns users sorted by usage', async () => {
    const plan = await seedPlan();
    await seedUser(plan, { email: 'top@test.com', mobile: '9000000001', licenseKey: 'TOPUSER_LIC001', usageMinutes: 100 });
    const token = await getAdminToken();
    const res = await request(app)
      .get('/api/analytics/active-users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].usageMinutes).toBe(100);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRIAL MODE
// ══════════════════════════════════════════════════════════════════════════════
describe('Trial Mode', () => {
  it('POST /api/session/start-trial — 201 starts trial for user with active plan', async () => {
    const plan = await seedPlan();
    await seedUser(plan, { licenseKey: 'TRIAL_ACTIVE_001', roundsRemaining: 3 });
    const res = await request(app)
      .post('/api/session/start-trial')
      .send({ licenseKey: 'TRIAL_ACTIVE_001' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.sessionType).toBe('trial');
    expect(res.body.trialDurationMinutes).toBe(9);
  });

  it('POST /api/session/start-trial — 201 allowed even with expired plan', async () => {
    const plan = await seedPlan();
    await seedUser(plan, {
      licenseKey: 'TRIAL_EXPIRED_01',
      roundsRemaining: 2,
      expiryDate: new Date(Date.now() - 1000 * 60 * 60), // expired 1 hour ago
    });
    const res = await request(app)
      .post('/api/session/start-trial')
      .send({ licenseKey: 'TRIAL_EXPIRED_01' });
    expect(res.status).toBe(201);
    expect(res.body.sessionType).toBe('trial');
  });

  it('POST /api/session/start-trial — 201 allowed when user has 0 rounds', async () => {
    const plan = await seedPlan();
    await seedUser(plan, { licenseKey: 'TRIAL_NOROUNDS_1', roundsRemaining: 0 });
    const res = await request(app)
      .post('/api/session/start-trial')
      .send({ licenseKey: 'TRIAL_NOROUNDS_1' });
    expect(res.status).toBe(201);
    expect(res.body.sessionType).toBe('trial');
  });

  it('POST /api/session/start-trial — 404 for invalid license key', async () => {
    const res = await request(app)
      .post('/api/session/start-trial')
      .send({ licenseKey: 'NONEXISTENT_TRIAL' });
    expect(res.status).toBe(404);
  });

  it('Trial session end — does NOT deduct round even after >9 minutes', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'TRIAL_END_001', roundsRemaining: 3 });

    // Create a trial session that started 15 minutes ago
    const session = await Session.create({
      userId: user._id,
      planId: undefined,
      sessionType: 'trial',
      startTime: new Date(Date.now() - 15 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/session/end')
      .send({ sessionId: session._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.session.countedAsRound).toBe(false);
    expect(res.body.session.sessionType).toBe('trial');

    // Rounds must remain unchanged
    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.roundsRemaining).toBe(3);
  });

  it('Trial session end — duration is capped at 9 minutes', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'TRIAL_CAP_001', roundsRemaining: 2 });

    const session = await Session.create({
      userId: user._id,
      sessionType: 'trial',
      startTime: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
    });

    const res = await request(app)
      .post('/api/session/end')
      .send({ sessionId: session._id.toString() });

    expect(res.status).toBe(200);
    // Duration must be capped at 9 minutes, not 20
    expect(res.body.session.durationMinutes).toBe(9);
  });

  it('Paid session — round IS deducted when duration > 9 minutes', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'PAID_LONG_TRIAL1', roundsRemaining: 3 });

    const session = await Session.create({
      userId: user._id,
      planId: plan._id,
      sessionType: 'paid',
      startTime: new Date(Date.now() - 15 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/session/end')
      .send({ sessionId: session._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.session.countedAsRound).toBe(true);
    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.roundsRemaining).toBe(2);
  });

  it('Paid session — round NOT deducted when duration ≤ 9 minutes', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'PAID_SHORT_TRL1', roundsRemaining: 3 });

    const session = await Session.create({
      userId: user._id,
      planId: plan._id,
      sessionType: 'paid',
      startTime: new Date(), // just now = 0 minutes
    });

    const res = await request(app)
      .post('/api/session/end')
      .send({ sessionId: session._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.session.countedAsRound).toBe(false);
    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.roundsRemaining).toBe(3);
  });

  it('Multiple trial sessions — all allowed, rounds never change', async () => {
    const plan = await seedPlan();
    const user = await seedUser(plan, { licenseKey: 'MULTI_TRIAL_001', roundsRemaining: 1 });

    for (let i = 0; i < 3; i++) {
      const startRes = await request(app)
        .post('/api/session/start-trial')
        .send({ licenseKey: 'MULTI_TRIAL_001' });
      expect(startRes.status).toBe(201);
      expect(startRes.body.sessionType).toBe('trial');

      await request(app)
        .post('/api/session/end')
        .send({ sessionId: startRes.body.sessionId });
    }

    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.roundsRemaining).toBe(1); // unchanged after 3 trials
  });
});

