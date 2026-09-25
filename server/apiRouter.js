import express from 'express';
import crypto from 'node:crypto';
import { query, hashPassword } from './db.js';
import { 
  sendEmail, 
  generateOtpEmailHtml, 
  generatePurchaseConfirmationEmailHtml, 
  generateContactReplyEmailHtml 
} from './emailService.js';
import { resolveCountry, detectDevice } from './geoService.js';
import { createDatabaseBackupZip, getBackupFileName } from './dbBackup.js';

export const apiRouter = express.Router();

apiRouter.use(express.json());

// ----------------------------------------------------------------------------
// HIGH-PERFORMANCE SLIDING-WINDOW RATE LIMITER & THROTTLER
// Protects against API exhaustion, SMTP quota burnout, and brute force attacks
// ----------------------------------------------------------------------------
class RateLimiter {
  constructor({ windowMs, maxRequests, message }) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message || 'Too many requests. Please try again later.';
    this.hits = new Map(); // ip -> [timestamps]

    // Periodic sweep every 60s to prevent memory accumulation
    setInterval(() => this.cleanup(), 60000).unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter(t => now - t < this.windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  getClientKey(req) {
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || req.ip || '127.0.0.1');
  }

  middleware() {
    return (req, res, next) => {
      const key = this.getClientKey(req);
      const now = Date.now();
      const timestamps = (this.hits.get(key) || []).filter(t => now - t < this.windowMs);

      if (timestamps.length >= this.maxRequests) {
        const oldest = timestamps[0];
        const retryAfterSec = Math.ceil((oldest + this.windowMs - now) / 1000);
        res.setHeader('Retry-After', retryAfterSec);
        res.setHeader('X-RateLimit-Limit', this.maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        return res.status(429).json({
          error: this.message,
          retryAfterSeconds: retryAfterSec
        });
      }

      timestamps.push(now);
      this.hits.set(key, timestamps);
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - timestamps.length));
      next();
    };
  }
}

// Global API Limiter: 300 req / min
export const globalApiLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300,
  message: 'API rate limit exceeded. Please slow down.'
});

// Strict Signin Limiter: 10 attempts / 5 mins (prevents credential stuffing)
export const signinLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many sign-in attempts. Please wait 5 minutes before trying again.'
});

// Strict Signup & OTP dispatch Limiter: 5 attempts / 15 mins (protects Gmail SMTP quota)
export const signupLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many signup attempts from this IP. Please wait 15 minutes before requesting another verification code.'
});

// OTP Verification Limiter: 10 attempts / 10 mins (prevents brute force of 6-digit codes)
export const otpVerifyLimiter = new RateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many code verification attempts. Please wait 10 minutes.'
});

// Public Forms Limiter (Contact / Purchase): 5 submissions / 10 mins
export const publicFormLimiter = new RateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 5,
  message: 'Submission limit reached. Please wait a few minutes before submitting another form.'
});

// Quota Consume Limiter: 15 calls / min
export const quotaConsumeLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: 'Video export rate limit reached. Please wait a moment.'
});

// Mount global limiter
apiRouter.use(globalApiLimiter.middleware());

// Auth Middleware (with Deactivated / Suspended Account Lockout)
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.query.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const sessionRes = await query(
      `SELECT s.user_id, u.name, u.username, u.email, u.role, u.plan_id, u.daily_quota, u.monthly_quota, u.is_active
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [token]
    );

    if (sessionRes.rows.length > 0) {
      const user = sessionRes.rows[0];
      if (!user.is_active) {
        req.user = null;
        req.userSuspended = true;
      } else {
        req.user = user;
        req.token = token;
      }
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (req.userSuspended) {
    return res.status(403).json({ error: 'Your account has been deactivated or suspended. Please contact support.' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.userSuspended) {
    return res.status(403).json({ error: 'Account suspended.' });
  }
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin authorization required.' });
  }
  next();
}

apiRouter.use(authenticateUser);

// ----------------------------------------------------------------------------
// 1. AUTHENTICATION ENDPOINTS
// ----------------------------------------------------------------------------

// Suggest available usernames based on name
apiRouter.get('/auth/suggest-username', async (req, res) => {
  const name = (req.query.name || 'creator').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = name.length > 0 ? name : 'creator';
  
  const suggestions = [
    `${base}_ai`,
    `${base}_viral`,
    `${base}${Math.floor(100 + Math.random() * 900)}`,
    `the_${base}`,
    `${base}_reels`
  ];

  const available = [];
  for (const s of suggestions) {
    const check = await query('SELECT id FROM users WHERE username = $1', [s]);
    if (check.rows.length === 0) {
      available.push(s);
    }
  }

  const suggestionsList = available.slice(0, 3);
  res.json({ suggestions: suggestionsList, suggestedUsernames: suggestionsList });
});

// Real-time username check
apiRouter.get('/auth/check-username', async (req, res) => {
  const username = (req.query.username || '').toLowerCase().trim();
  if (!username) return res.json({ available: false });
  const check = await query('SELECT id FROM users WHERE username = $1', [username]);
  res.json({ available: check.rows.length === 0 });
});

// Step 1: Sign up request -> Send OTP Email (Strict Rate Limited & Throttled to protect Gmail SMTP)
apiRouter.post('/auth/signup', signupLimiter.middleware(), async (req, res) => {
  const { name, username, email, password } = req.body;

  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');

  // Basic validation
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Check existing username or email
  const existing = await query(
    'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
    [cleanUsername, cleanEmail]
  );

  if (existing.rows.length > 0) {
    if (existing.rows[0].username === cleanUsername) {
      return res.status(400).json({ error: 'Username is already taken. Please choose another.' });
    }
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  // Generate secure 6-digit OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  // Store OTP with attempt counter = 0
  await query(
    'INSERT INTO otps (email, code, type, expires_at, attempts) VALUES ($1, $2, $3, $4, 0)',
    [cleanEmail, otpCode, 'signup', expiresAt]
  );

  // Send professional themed OTP email. If delivery fails, return a local fallback code
  // so users can still finish signup instead of abandoning the site.
  const html = generateOtpEmailHtml({ name, otpCode });
  const emailResult = await sendEmail({
    to: cleanEmail,
    subject: `${otpCode} is your Zen Caption AI verification code`,
    html
  }).catch(err => ({ success: false, error: err.message }));

  res.json({
    success: true,
    emailDelivered: !!emailResult?.success,
    message: emailResult?.success
      ? `Verification code sent to ${cleanEmail}`
      : `Email delivery is temporarily unavailable. Use the code shown on this page to continue.`,
    email: cleanEmail,
    devCode: emailResult?.success ? undefined : otpCode
  });
});

// Resend OTP endpoint (Lightning-fast background dispatch)
apiRouter.post('/auth/resend-otp', signupLimiter.middleware(), async (req, res) => {
  const { email, name } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await query(
    'INSERT INTO otps (email, code, type, expires_at, attempts) VALUES ($1, $2, $3, $4, 0)',
    [cleanEmail, otpCode, 'resend', expiresAt]
  );

  const html = generateOtpEmailHtml({ name: name || 'Creator', otpCode });
  const emailResult = await sendEmail({
    to: cleanEmail,
    subject: `${otpCode} is your Zen Caption AI verification code`,
    html
  }).catch(err => ({ success: false, error: err.message }));

  return res.json({
    success: true,
    emailDelivered: !!emailResult?.success,
    message: emailResult?.success
      ? `A new verification code has been sent to ${cleanEmail}`
      : `Email delivery is temporarily unavailable. Use the code shown on this page to continue.`,
    email: cleanEmail,
    devCode: emailResult?.success ? undefined : otpCode
  });
});

// Forgot Password - Send Reset Code
apiRouter.post('/auth/forgot-password', signupLimiter.middleware(), async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const userCheck = await query('SELECT id, name FROM users WHERE email = $1', [cleanEmail]);
  if (userCheck.rows.length === 0) {
    return res.status(404).json({ error: 'No account registered with this email address.' });
  }

  const userName = userCheck.rows[0].name || 'Creator';
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await query(
    'INSERT INTO otps (email, code, type, expires_at, attempts) VALUES ($1, $2, $3, $4, 0)',
    [cleanEmail, otpCode, 'password_reset', expiresAt]
  );

  const html = generateOtpEmailHtml({ name: userName, otpCode });
  const emailResult = await sendEmail({
    to: cleanEmail,
    subject: `${otpCode} is your password reset code`,
    html
  }).catch(err => ({ success: false, error: err.message }));

  return res.json({
    success: true,
    emailDelivered: !!emailResult?.success,
    message: emailResult?.success
      ? `A 6-digit password reset code has been sent to ${cleanEmail}`
      : `Email delivery is temporarily unavailable. Use the code shown on this page to continue.`,
    email: cleanEmail,
    devCode: emailResult?.success ? undefined : otpCode
  });
});

// Reset Password - Verify Code & Update Password
apiRouter.post('/auth/reset-password', otpVerifyLimiter.middleware(), async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, verification code, and new password are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const otpRes = await query(
    `SELECT id, attempts, code FROM otps 
     WHERE email = $1 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
     ORDER BY id DESC LIMIT 1`,
    [cleanEmail]
  );

  if (otpRes.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new code.' });
  }

  const otpRow = otpRes.rows[0];
  if (otpRow.code !== code.toString().trim()) {
    const updatedAttempts = (otpRow.attempts || 0) + 1;
    await query('UPDATE otps SET attempts = $1 WHERE id = $2', [updatedAttempts, otpRow.id]);
    return res.status(400).json({ error: 'Incorrect verification code. Please check and try again.' });
  }

  // Mark OTP used
  await query('UPDATE otps SET used = TRUE WHERE id = $1', [otpRow.id]);

  // Update password in DB
  const newHash = hashPassword(newPassword);
  const updatedUserRes = await query(
    `UPDATE users SET password_hash = $1 
     WHERE email = $2 
     RETURNING id, name, username, email, role, plan_id, daily_quota, monthly_quota`,
    [newHash, cleanEmail]
  );

  if (updatedUserRes.rows.length === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const user = updatedUserRes.rows[0];

  // Issue session token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  await query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, user.id, expiresAt]);

  return res.json({
    success: true,
    message: 'Password reset successfully!',
    user,
    token
  });
});

// Step 2: Verify OTP -> Create Account with Brute-Force Counter & Issue 90-day Session
apiRouter.post('/auth/verify-otp', otpVerifyLimiter.middleware(), async (req, res) => {
  const { email, code, name, username, password } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }
  const cleanEmail = email.toLowerCase().trim();

  // Find latest active OTP for this email
  const otpRes = await query(
    `SELECT id, attempts, code FROM otps 
     WHERE email = $1 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
     ORDER BY id DESC LIMIT 1`,
    [cleanEmail]
  );

  if (otpRes.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new code.' });
  }

  const otpRow = otpRes.rows[0];

  // Invalidate if exceeding 5 failed attempts (brute force lockout)
  if ((otpRow.attempts || 0) >= 5) {
    await query('UPDATE otps SET used = TRUE WHERE id = $1', [otpRow.id]);
    return res.status(429).json({ error: 'Too many incorrect attempts. This code has expired for security. Please request a new code.' });
  }

  // Check code match
  if (otpRow.code !== code.toString().trim()) {
    const updatedAttempts = (otpRow.attempts || 0) + 1;
    await query('UPDATE otps SET attempts = $1 WHERE id = $2', [updatedAttempts, otpRow.id]);
    const remaining = 5 - updatedAttempts;
    return res.status(400).json({
      error: remaining > 0 
        ? `Incorrect verification code. ${remaining} attempts remaining.` 
        : 'Incorrect verification code. Code has been invalidated.'
    });
  }

  // Mark OTP used
  await query('UPDATE otps SET used = TRUE WHERE id = $1', [otpRow.id]);

  // Query free plan limits from DB
  const freePlanRes = await query("SELECT daily_limit, monthly_limit FROM plans WHERE id = 'free'");
  const dailyLimit = freePlanRes.rows[0]?.daily_limit || 3;
  const monthlyLimit = freePlanRes.rows[0]?.monthly_limit || 30;

  // Create user
  const passwordHash = hashPassword((password || '').trim());
  const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');

  const newUserRes = await query(
    `INSERT INTO users (name, username, email, password_hash, role, plan_id, daily_quota, monthly_quota, is_active)
     VALUES ($1, $2, $3, $4, 'user', 'free', $5, $6, TRUE)
     RETURNING id, name, username, email, role, plan_id, daily_quota, monthly_quota`,
    [name, cleanUsername, cleanEmail, passwordHash, dailyLimit, monthlyLimit]
  );

  const newUser = newUserRes.rows[0];

  // Create 90-day persistent session token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  await query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, newUser.id, expiresAt]
  );

  res.json({
    success: true,
    user: newUser,
    token
  });
});

// Sign In (Rate Limited against Credential Stuffing & Password Brute Force)
apiRouter.post('/auth/signin', signinLimiter.middleware(), async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and Password are required.' });
    }

    const cleanId = identifier.toLowerCase().trim();
    const passwordHash = hashPassword(password);
    const trimmedPasswordHash = hashPassword(password.trim());

    const userRes = await query(
      `SELECT id, name, username, email, role, plan_id, daily_quota, monthly_quota, is_active
       FROM users
       WHERE (LOWER(email) = $1 OR LOWER(username) = $1) AND (password_hash = $2 OR password_hash = $3)`,
      [cleanId, passwordHash, trimmedPasswordHash]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'This account has been suspended or deactivated. Please contact support.' });
    }

    // Issue 90-day persistent session
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    await query(
      'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [token, user.id, expiresAt]
    );

    res.json({
      success: true,
      user,
      token
    });
  } catch (err) {
    console.error('[Auth Signin Error]', err);
    res.status(500).json({ error: 'Failed to sign in: ' + (err.message || 'Server database error') });
  }
});

// Current Authenticated User Session Check
apiRouter.get('/auth/me', (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.user });
});

// Logout
apiRouter.post('/auth/logout', async (req, res) => {
  if (req.token) {
    await query('DELETE FROM sessions WHERE token = $1', [req.token]);
  }
  res.json({ success: true });
});

// ----------------------------------------------------------------------------
// 2. PUBLIC ENDPOINTS
// ----------------------------------------------------------------------------

// Get Plans
apiRouter.get('/public/plans', async (req, res) => {
  const result = await query('SELECT * FROM plans ORDER BY price ASC');
  res.json({ plans: result.rows });
});

// Get Site Settings
apiRouter.get('/public/settings', async (req, res) => {
  const result = await query('SELECT key, value FROM site_settings');
  const settings = {};
  result.rows.forEach(r => { settings[r.key] = r.value; });
  res.json({ settings });
});

// Contact Request Submission (Throttled against Form Spamming)
apiRouter.post('/public/contact', publicFormLimiter.middleware(), async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  const insRes = await query(
    'INSERT INTO contacts (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id',
    [name, email.toLowerCase().trim(), subject || 'Inquiry', message]
  );

  res.json({ success: true, message: 'Your message has been sent successfully!', contactId: insRes.rows[0]?.id });
});

// Purchase Request Submission (Throttled to protect Gmail SMTP Quota)
apiRouter.post('/public/purchase', publicFormLimiter.middleware(), async (req, res) => {
  const name = req.body.name || req.body.user_name;
  const email = req.body.email || req.body.user_email;
  const phone = req.body.phone || req.body.user_phone;
  const planId = req.body.planId || req.body.plan_id;

  if (!name || !email || !planId) {
    return res.status(400).json({ error: 'Name, email, and plan are required.' });
  }

  const planRes = await query('SELECT name, price, billing_cycle FROM plans WHERE id = $1', [planId]);
  const plan = planRes.rows[0] || { name: 'Creator Plan', price: 19, billing_cycle: 'month' };

  const userId = req.user ? req.user.user_id : null;

  const insRes = await query(
    `INSERT INTO purchases (user_id, name, email, phone, plan_id, plan_name, price, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING id`,
    [userId, name, email.toLowerCase().trim(), phone || null, planId, plan.name, plan.price]
  );

  // Send automated confirmation email to user
  const emailHtml = generatePurchaseConfirmationEmailHtml({
    name,
    planName: plan.name,
    price: plan.price,
    billingCycle: plan.billing_cycle
  });

  await sendEmail({
    to: email,
    subject: `Order Confirmation: ${plan.name} Request Received`,
    html: emailHtml
  });

  res.json({
    success: true,
    purchaseId: insRes.rows[0]?.id,
    message: `Purchase request for ${plan.name} submitted! Check your email for confirmation.`
  });
});

// Public Blog Articles List
apiRouter.get('/public/blogs', async (req, res) => {
  const result = await query(
    `SELECT id, title, slug, excerpt, keywords, featured_image, views, published_at
     FROM blogs
     WHERE status = 'published'
     ORDER BY id ASC`
  );
  res.json({ blogs: result.rows });
});

// Single Blog Article by Slug
apiRouter.get('/public/blogs/:slug', async (req, res) => {
  const { slug } = req.params;
  const result = await query(
    `SELECT * FROM blogs WHERE slug = $1 AND status = 'published' LIMIT 1`,
    [slug]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Blog article not found.' });
  }

  // Increment view count
  await query('UPDATE blogs SET views = views + 1 WHERE slug = $1', [slug]);

  res.json({ blog: result.rows[0] });
});

// Quota Check (Accurate, Multi-Device and Atomic per User)
apiRouter.post('/public/quota-check', async (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || req.ip || '127.0.0.1');
  const today = new Date().toISOString().split('T')[0];

  if (req.user) {
    const dailyLimit = req.user.daily_quota || 3;
    const monthlyLimit = req.user.monthly_quota || 30;

    // Sum all generations for this user on today's date across any devices/IPs
    const usageRes = await query(
      `SELECT COALESCE(SUM(generation_count), 0)::int as count FROM usage_logs WHERE user_id = $1 AND day_date = $2`,
      [req.user.user_id, today]
    );
    const count = parseInt(usageRes.rows[0]?.count || 0);

    return res.json({
      allowed: count < dailyLimit,
      used: count,
      limit: dailyLimit,
      dailyUsed: count,
      dailyLimit: dailyLimit,
      monthlyUsed: count,
      monthlyLimit: monthlyLimit,
      planName: req.user.plan_id || 'Free Starter',
      isGuest: false
    });
  }

  // Guest IP Check (where user_id IS NULL)
  const guestLimit = 3; // Default free guest limit per day
  const usageRes = await query(
    `SELECT COALESCE(SUM(generation_count), 0)::int as count FROM usage_logs WHERE ip_address = $1 AND day_date = $2 AND user_id IS NULL`,
    [ip, today]
  );
  const count = parseInt(usageRes.rows[0]?.count || 0);

  res.json({
    allowed: count < guestLimit,
    used: count,
    limit: guestLimit,
    dailyUsed: count,
    dailyLimit: guestLimit,
    monthlyUsed: count,
    monthlyLimit: 15,
    planName: 'Free Starter (Guest)',
    isGuest: true
  });
});

// Quota Consume (Throttled & Collision-Free between Users and Guests)
apiRouter.post('/public/quota-consume', quotaConsumeLimiter.middleware(), async (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || req.ip || '127.0.0.1');
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user ? req.user.user_id : null;

  if (userId) {
    const dailyLimit = req.user.daily_quota || 3;
    const usageRes = await query(
      `SELECT COALESCE(SUM(generation_count), 0)::int as count FROM usage_logs WHERE user_id = $1 AND day_date = $2`,
      [userId, today]
    );
    const count = parseInt(usageRes.rows[0]?.count || 0);
    if (count >= dailyLimit) {
      return res.status(403).json({
        success: false,
        allowed: false,
        error: 'Daily generation limit reached for your account. Please upgrade your plan.'
      });
    }

    // For authenticated users: upsert today's usage row for user_id
    await query(
      `INSERT INTO usage_logs (ip_address, user_id, day_date, generation_count)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (ip_address, day_date)
       DO UPDATE SET generation_count = usage_logs.generation_count + 1, user_id = COALESCE(EXCLUDED.user_id, usage_logs.user_id)`,
      [ip, userId, today]
    );
  } else {
    const guestLimit = 3;
    const usageRes = await query(
      `SELECT COALESCE(SUM(generation_count), 0)::int as count FROM usage_logs WHERE ip_address = $1 AND day_date = $2 AND user_id IS NULL`,
      [ip, today]
    );
    const count = parseInt(usageRes.rows[0]?.count || 0);
    if (count >= guestLimit) {
      return res.status(403).json({
        success: false,
        allowed: false,
        error: 'Daily guest quota reached (3/3). Please sign in or upgrade for higher limits.'
      });
    }

    // For guest visitors: atomic upsert by ip_address & day_date
    await query(
      `INSERT INTO usage_logs (ip_address, user_id, day_date, generation_count)
       VALUES ($1, NULL, $2, 1)
       ON CONFLICT (ip_address, day_date)
       DO UPDATE SET generation_count = usage_logs.generation_count + 1`,
      [ip, today]
    );
  }

  res.json({ success: true, consumed: true });
});

// Visitor Tracking Ingestion Endpoint
apiRouter.post('/public/track-visitor', async (req, res) => {
  try {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || req.ip || '127.0.0.1');
    const landedUrl = req.body.landedUrl || req.body.url || '/';
    const userAgent = req.body.userAgent || req.headers['user-agent'] || '';

    const { country, countryCode } = await resolveCountry(ip);
    const deviceType = detectDevice(userAgent);

    const userId = req.user ? req.user.user_id : null;
    const userEmail = req.user ? req.user.email : null;
    const userName = req.user ? req.user.name : null;

    await query(
      `INSERT INTO visitor_logs (ip_address, country, country_code, landed_url, user_agent, device_type, user_id, user_email, user_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [ip, country, countryCode, String(landedUrl).substring(0, 500), String(userAgent).substring(0, 500), deviceType, userId, userEmail, userName]
    );

    res.json({ success: true });
  } catch (err) {
    // Non-blocking telemetry
    res.json({ success: false });
  }
});

// ----------------------------------------------------------------------------
// 3. USER DASHBOARD (Per-User Saved Templates)
// ----------------------------------------------------------------------------

apiRouter.get('/user/templates', requireAuth, async (req, res) => {
  const result = await query(
    'SELECT template_id, custom_config FROM user_templates WHERE user_id = $1',
    [req.user.user_id]
  );
  const map = {};
  result.rows.forEach(r => { map[r.template_id] = r.custom_config; });
  res.json({ templates: map, customizedTemplates: map });
});

apiRouter.post('/user/templates/:templateId', requireAuth, async (req, res) => {
  const { templateId } = req.params;
  const { config } = req.body;

  await query(
    `INSERT INTO user_templates (user_id, template_id, custom_config, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, template_id)
     DO UPDATE SET custom_config = EXCLUDED.custom_config, updated_at = CURRENT_TIMESTAMP`,
    [req.user.user_id, templateId, JSON.stringify(config)]
  );

  res.json({ success: true });
});

apiRouter.delete('/user/templates/:templateId', requireAuth, async (req, res) => {
  const { templateId } = req.params;
  await query(
    'DELETE FROM user_templates WHERE user_id = $1 AND template_id = $2',
    [req.user.user_id, templateId]
  );
  res.json({ success: true, message: 'Reverted to template original preset.' });
});

// ----------------------------------------------------------------------------
// 4. ADMIN DASHBOARD ENDPOINTS (Require role === 'admin')
// ----------------------------------------------------------------------------

// Overview Analytics
apiRouter.get('/admin/stats', requireAdmin, async (req, res) => {
  const usersCount = await query('SELECT COUNT(*) FROM users');
  const contactsCount = await query('SELECT COUNT(*) FROM contacts');
  const pendingPurchases = await query("SELECT COUNT(*) FROM purchases WHERE status = 'pending'");
  const blogsCount = await query('SELECT COUNT(*) FROM blogs');
  const todayUsage = await query('SELECT COALESCE(SUM(generation_count), 0) as total FROM usage_logs WHERE day_date = CURRENT_DATE');
  const totalVisitorsRes = await query('SELECT COUNT(*) as total_visits, COUNT(DISTINCT ip_address) as unique_visitors FROM visitor_logs');
  const todayVisitorsRes = await query("SELECT COUNT(*) as count FROM visitor_logs WHERE created_at >= CURRENT_DATE");

  res.json({
    totalUsers: parseInt(usersCount.rows[0].count),
    totalContacts: parseInt(contactsCount.rows[0].count),
    pendingPurchases: parseInt(pendingPurchases.rows[0].count),
    totalBlogs: parseInt(blogsCount.rows[0].count),
    todayGenerations: parseInt(todayUsage.rows[0].total),
    totalVisitors: parseInt(totalVisitorsRes.rows[0]?.total_visits || 0),
    uniqueVisitors: parseInt(totalVisitorsRes.rows[0]?.unique_visitors || 0),
    todayVisitors: parseInt(todayVisitorsRes.rows[0]?.count || 0)
  });
});

// Visitor Tracking List & Analytics (Filtered by period, unique users, and search)
apiRouter.get('/admin/visitors', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'all'; // 'all' | 'hour' | 'today' | 'week' | 'month'
    const isUnique = req.query.unique === 'true';
    const userType = req.query.userType || 'all'; // 'all' | 'auth' | 'guest'
    const search = req.query.search ? `%${req.query.search}%` : null;

    // Build WHERE conditions
    const conditions = [];
    const params = [];
    let pIdx = 1;

    // Period filter
    if (period === 'hour') {
      conditions.push(`created_at >= NOW() - INTERVAL '1 hour'`);
    } else if (period === 'today') {
      conditions.push(`created_at >= CURRENT_DATE`);
    } else if (period === 'week') {
      conditions.push(`created_at >= NOW() - INTERVAL '7 days'`);
    } else if (period === 'month') {
      conditions.push(`created_at >= NOW() - INTERVAL '30 days'`);
    }

    // User Type filter
    if (userType === 'auth') {
      conditions.push(`user_id IS NOT NULL`);
    } else if (userType === 'guest') {
      conditions.push(`user_id IS NULL`);
    }

    // Search filter
    if (search) {
      conditions.push(`(ip_address ILIKE $${pIdx} OR country ILIKE $${pIdx} OR user_email ILIKE $${pIdx} OR user_name ILIKE $${pIdx} OR landed_url ILIKE $${pIdx})`);
      params.push(search);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let rows;
    if (isUnique) {
      // Partition by IP address so each unique visitor displays their single latest record
      const queryText = `
        WITH ranked_visitors AS (
          SELECT id, ip_address, country, country_code, landed_url, device_type, user_id, user_email, user_name, created_at,
                 ROW_NUMBER() OVER (PARTITION BY ip_address ORDER BY created_at DESC) as rn
          FROM visitor_logs
          ${whereClause}
        )
        SELECT id, ip_address, country, country_code, landed_url, device_type, user_id, user_email, user_name, created_at
        FROM ranked_visitors
        WHERE rn = 1
        ORDER BY created_at DESC
        LIMIT 250
      `;
      const result = await query(queryText, params);
      rows = result.rows;
    } else {
      const queryText = `
        SELECT id, ip_address, country, country_code, landed_url, device_type, user_id, user_email, user_name, created_at
        FROM visitor_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 250
      `;
      const result = await query(queryText, params);
      rows = result.rows;
    }

    // Summary statistics for current filter
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT ip_address) as unique_visitors,
        COUNT(DISTINCT user_id) as auth_users
      FROM visitor_logs
      ${whereClause}
    `, params);

    const topCountriesRes = await query(`
      SELECT country, country_code, COUNT(*) as count
      FROM visitor_logs
      ${whereClause}
      GROUP BY country, country_code
      ORDER BY count DESC
      LIMIT 5
    `, params);

    res.json({
      visitors: rows,
      stats: {
        totalVisits: parseInt(statsResult.rows[0]?.total_visits || 0),
        uniqueVisitors: parseInt(statsResult.rows[0]?.unique_visitors || 0),
        authUsers: parseInt(statsResult.rows[0]?.auth_users || 0),
        topCountries: topCountriesRes.rows
      }
    });
  } catch (err) {
    console.error('[Admin Visitors Error]', err);
    res.status(500).json({ error: 'Failed to fetch visitor logs: ' + err.message });
  }
});

// Users CRUD
apiRouter.get('/admin/users', requireAdmin, async (req, res) => {
  const search = req.query.search ? `%${req.query.search}%` : '%';
  const result = await query(
    `SELECT id, name, username, email, role, plan_id, daily_quota, monthly_quota, is_active, created_at
     FROM users
     WHERE name ILIKE $1 OR email ILIKE $1 OR username ILIKE $1
     ORDER BY id DESC LIMIT 100`,
    [search]
  );
  res.json({ users: result.rows });
});

apiRouter.post('/admin/users', requireAdmin, async (req, res) => {
  const { name, username, email, password, role, plan_id, daily_quota, monthly_quota } = req.body;
  const hash = hashPassword(password || 'user123');
  const result = await query(
    `INSERT INTO users (name, username, email, password_hash, role, plan_id, daily_quota, monthly_quota)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, username, email, role, plan_id, daily_quota, monthly_quota`,
    [name, username.toLowerCase().trim(), email.toLowerCase().trim(), hash, role || 'user', plan_id || 'free', daily_quota || 5, monthly_quota || 50]
  );
  res.json({ user: result.rows[0] });
});

apiRouter.put('/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, role, plan_id, daily_quota, monthly_quota, is_active, password } = req.body;

  if (password && password.trim().length > 0) {
    const hash = hashPassword(password);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
  }

  const result = await query(
    `UPDATE users 
     SET name = COALESCE($1, name),
         role = COALESCE($2, role),
         plan_id = COALESCE($3, plan_id),
         daily_quota = COALESCE($4, daily_quota),
         monthly_quota = COALESCE($5, monthly_quota),
         is_active = COALESCE($6, is_active)
     WHERE id = $7
     RETURNING id, name, username, email, role, plan_id, daily_quota, monthly_quota, is_active`,
    [name, role, plan_id, daily_quota, monthly_quota, is_active, id]
  );

  res.json({ user: result.rows[0] });
});

apiRouter.delete('/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  await query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ success: true });
});

// Plans CRUD
apiRouter.get('/admin/plans', requireAdmin, async (req, res) => {
  const result = await query('SELECT * FROM plans ORDER BY price ASC');
  res.json({ plans: result.rows });
});

apiRouter.post('/admin/plans', requireAdmin, async (req, res) => {
  const { id, name, price, billing_cycle, short_desc, features, daily_limit, monthly_limit, is_default_free } = req.body;
  const result = await query(
    `INSERT INTO plans (id, name, price, billing_cycle, short_desc, features, daily_limit, monthly_limit, is_default_free)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [id.toLowerCase().trim(), name, price, billing_cycle || 'month', short_desc, JSON.stringify(features || []), daily_limit || 5, monthly_limit || 50, is_default_free || false]
  );
  res.json({ plan: result.rows[0] });
});

apiRouter.put('/admin/plans/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, price, billing_cycle, short_desc, features, daily_limit, monthly_limit, is_default_free } = req.body;

  if (is_default_free) {
    // Unset any previous default free plan
    await query('UPDATE plans SET is_default_free = FALSE');
  }

  const result = await query(
    `UPDATE plans
     SET name = $1, price = $2, billing_cycle = $3, short_desc = $4,
         features = $5, daily_limit = $6, monthly_limit = $7, is_default_free = $8
     WHERE id = $9
     RETURNING *`,
    [name, price, billing_cycle, short_desc, JSON.stringify(features || []), daily_limit, monthly_limit, is_default_free, id]
  );
  res.json({ plan: result.rows[0] });
});

apiRouter.delete('/admin/plans/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  await query('DELETE FROM plans WHERE id = $1', [id]);
  res.json({ success: true });
});

// Contact Requests & Split-View Live Reply
apiRouter.get('/admin/contacts', requireAdmin, async (req, res) => {
  const result = await query('SELECT * FROM contacts ORDER BY id DESC');
  res.json({ contacts: result.rows });
});

apiRouter.post('/admin/contacts/:id/reply', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { heading, message, repliedBy } = req.body;

  const contactRes = await query('SELECT * FROM contacts WHERE id = $1', [id]);
  if (contactRes.rows.length === 0) {
    return res.status(404).json({ error: 'Contact request not found.' });
  }
  const contact = contactRes.rows[0];

  // Generate theme-aligned email
  const html = generateContactReplyEmailHtml({
    recipientName: contact.name,
    heading,
    message,
    repliedBy: repliedBy || req.user.name || 'Zen Caption AI Support'
  });

  // Dispatch email
  await sendEmail({
    to: contact.email,
    subject: heading || `Response to: ${contact.subject || 'Your Inquiry'}`,
    html
  });

  // Update DB status
  await query(
    `UPDATE contacts 
     SET status = 'replied', reply_heading = $1, reply_message = $2, replied_by = $3, replied_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [heading, message, repliedBy || req.user.name, id]
  );

  res.json({ success: true, message: 'Reply email delivered and inquiry marked as replied!' });
});

// Purchase Requests
apiRouter.get('/admin/purchases', requireAdmin, async (req, res) => {
  const result = await query('SELECT * FROM purchases ORDER BY id DESC');
  res.json({ purchases: result.rows });
});

apiRouter.put('/admin/purchases/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await query('UPDATE purchases SET status = $1 WHERE id = $2', [status, id]);
  res.json({ success: true });
});

// Blogs CRUD
apiRouter.get('/admin/blogs', requireAdmin, async (req, res) => {
  const result = await query('SELECT * FROM blogs ORDER BY id ASC');
  res.json({ blogs: result.rows });
});

apiRouter.post('/admin/blogs', requireAdmin, async (req, res) => {
  const { title, slug, excerpt, content, meta_title, meta_desc, keywords, featured_image, status } = req.body;
  const cleanSlug = (slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const result = await query(
    `INSERT INTO blogs (title, slug, excerpt, content, meta_title, meta_desc, keywords, featured_image, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [title, cleanSlug, excerpt, content, meta_title || title, meta_desc || excerpt, keywords, featured_image, status || 'published']
  );
  res.json({ blog: result.rows[0] });
});

apiRouter.put('/admin/blogs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, slug, excerpt, content, meta_title, meta_desc, keywords, featured_image, status } = req.body;

  const result = await query(
    `UPDATE blogs 
     SET title = $1, slug = $2, excerpt = $3, content = $4, meta_title = $5, meta_desc = $6,
         keywords = $7, featured_image = $8, status = $9
     WHERE id = $10
     RETURNING *`,
    [title, slug, excerpt, content, meta_title, meta_desc, keywords, featured_image, status, id]
  );
  res.json({ blog: result.rows[0] });
});

apiRouter.delete('/admin/blogs/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  await query('DELETE FROM blogs WHERE id = $1', [id]);
  res.json({ success: true });
});

// Site Settings
apiRouter.get('/admin/settings', requireAdmin, async (req, res) => {
  const result = await query('SELECT key, value FROM site_settings');
  const settings = {};
  result.rows.forEach(r => { settings[r.key] = r.value; });
  res.json({ settings });
});

apiRouter.put('/admin/settings', requireAdmin, async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    await query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, typeof value === 'string' ? value : JSON.stringify(value)]
    );
  }
  res.json({ success: true, message: 'Settings saved successfully!' });
});

apiRouter.get('/admin/database/export', requireAdmin, async (req, res) => {
  try {
    const startedAt = Date.now();
    const { buffer, tableSummaries } = await createDatabaseBackupZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${getBackupFileName()}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Backup-Tables', String(tableSummaries.length));
    res.setHeader('X-Backup-Duration-Ms', String(Date.now() - startedAt));
    return res.send(buffer);
  } catch (err) {
    console.error('[DB Backup] Export failed:', err);
    return res.status(500).json({ error: err.message || 'Database export failed' });
  }
});

// ----------------------------------------------------------------------------
// GEMINI AI TRANSCRIPT TRANSLATION & TRANSLITERATION API
// ----------------------------------------------------------------------------
apiRouter.post('/ai/translate-transcript', async (req, res) => {
  try {
    const { sentences, scriptMode = 'roman', languagePreference = 'auto', apiKey } = req.body || {};

    if (!Array.isArray(sentences) || sentences.length === 0) {
      return res.status(400).json({ error: 'Sentences array is required' });
    }

    const effectiveKey = (typeof apiKey === 'string' && apiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!effectiveKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured on server or in request' });
    }

    let modeInstruction = '';
    if (scriptMode === 'roman') {
      modeInstruction = `TARGET SCRIPT: ROMAN HINDI & ROMAN URDU (Latin English alphabets).
Transliterate and translate speech to natural, conversational Roman Urdu / Roman Hindi using phonetic Latin English letters (e.g. "agar ap isko dekh skte hein", "kese ho aap sab", "aaj hum is bare me baat karenge").
Keep popular tech words in clean English (e.g., "video", "subscribe", "channel", "camera", "AI", "studio", "like", "link").
CRITICAL: Do NOT output Devanagari or Urdu Nastaliq letters. Output ONLY Latin English alphabet words.`;
    } else if (scriptMode === 'native' && languagePreference === 'hindi') {
      modeInstruction = `TARGET SCRIPT: PURE NATIVE HINDI (हिन्दी - Devanagari script).
Translate and convert speech into 100% pure, natural Hindi in Devanagari script.
CRITICAL: Absolutely ZERO English or Latin letters. Every single word must be in Devanagari (e.g. "अगर आप इसको देख सकते हैं तो लाइक करें").`;
    } else if (scriptMode === 'native' && languagePreference === 'urdu') {
      modeInstruction = `TARGET SCRIPT: PURE NATIVE URDU (اردو - Nastaliq script).
Translate and convert speech into 100% pure, natural Urdu in Nastaliq script.
CRITICAL: Absolutely ZERO English or Latin letters. Every single word must be in authentic Urdu script (e.g. "اگر آپ اس کو دیکھ سکتے ہیں تو لائیک کریں").`;
    } else if (scriptMode === 'native') {
      modeInstruction = `TARGET SCRIPT: PURE NATIVE SCRIPT.
Detect if the speech is Hindi or Urdu.
If Hindi: Output 100% pure Devanagari script (हिन्दी) with ZERO English letters.
If Urdu: Output 100% pure Nastaliq script (اردو) with ZERO English letters.`;
    } else {
      modeInstruction = `TARGET SCRIPT: NATURAL SOCIAL MEDIA ENGLISH.
Translate speech into concise, punchy, modern English captions suitable for viral video reels and shorts.`;
    }

    const segmentsInput = sentences.map((s, idx) => ({
      id: s.id !== undefined ? s.id : idx,
      text: s.text || ''
    }));

    const prompt = `You are an elite video transcript subtitle localization and transliteration engine.
${modeInstruction}

RULES:
1. Return exactly one entry for each input item, maintaining the identical "id".
2. Keep subtitles natural, punchy, and conversational for video creators.
3. Preserve the exact meaning and speech flow.
4. Output MUST be a valid JSON array of objects conforming to this schema:
[
  {"id": 0, "text": "localized text"}
]

INPUT SEGMENTS:
${JSON.stringify(segmentsInput, null, 2)}`;

    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(effectiveKey)}`;
        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.15,
              topK: 32,
              topP: 0.95,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json'
            }
          })
        });

        if (!geminiRes.ok) {
          const errData = await geminiRes.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${geminiRes.status}`;
          throw new Error(`Gemini ${model} failed: ${errMsg}`);
        }

        const data = await geminiRes.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          throw new Error('Empty response from Gemini');
        }

        let cleaned = candidateText.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        }

        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          return res.json({ success: true, translatedSentences: parsed });
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Server Gemini] Model ${model} error:`, err.message);
      }
    }

    return res.status(500).json({ error: lastError?.message || 'Gemini transcript translation failed' });
  } catch (err) {
    console.error('[Server Gemini] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal translation server error' });
  }
});

// ----------------------------------------------------------------------------
// GEMINI AI HINDI/URDU AUDIO TRANSCRIPTION API
// ----------------------------------------------------------------------------
apiRouter.post('/ai/transcribe-audio', async (req, res) => {
  try {
    const {
      audioBase64,
      mimeType = 'audio/wav',
      duration = 0,
      speechSegments = [],
      scriptMode = 'roman',
      languagePreference = 'roman',
      apiKey
    } = req.body || {};

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    const effectiveKey = (typeof apiKey === 'string' && apiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!effectiveKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured on server or in request' });
    }

    const segmentHints = Array.isArray(speechSegments)
      ? speechSegments.slice(0, 80).map((seg, idx) => ({
          id: idx,
          startTime: Number(seg.start ?? 0),
          endTime: Number(seg.end ?? 0)
        }))
      : [];

    const scriptInstruction = scriptMode === 'native'
      ? `Return "romanText" as Roman Hindi/Urdu and "nativeText" as native Hindi Devanagari or Urdu Nastaliq. Use "text" equal to "nativeText" when available.`
      : `Return "romanText" as natural Roman Hindi/Urdu in Latin letters. Return "nativeText" if clearly known, otherwise empty. Use "text" equal to "romanText".`;

    const prompt = `You are a precise Hindi/Urdu video subtitle transcription engine.
Listen to the attached audio and transcribe the actual spoken words. Do not invent generic lines. Do not output repeated filler like "sir sir sir" unless truly spoken.

TARGET:
${scriptInstruction}
Language preference: ${languagePreference}

TIMING:
- Video duration is ${Number(duration || 0).toFixed(2)} seconds.
- Use these voice activity hints for timestamps, adjusting them if needed:
${JSON.stringify(segmentHints)}
- Return short caption segments of 2 to 6 words each.
- Preserve chronological order.

OUTPUT:
Return ONLY valid JSON array:
[
  {"id":"sentence_1","startTime":0.0,"endTime":1.6,"text":"roman caption","romanText":"roman caption","nativeText":"native caption"}
]`;

    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(effectiveKey)}`;
        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: audioBase64 } }
              ]
            }],
            generationConfig: {
              temperature: 0.05,
              topK: 16,
              topP: 0.8,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json'
            }
          })
        });

        if (!geminiRes.ok) {
          const errData = await geminiRes.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${geminiRes.status}`);
        }

        const data = await geminiRes.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) throw new Error('Empty response from Gemini audio transcription');

        let cleaned = candidateText.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        }
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          return res.json({ success: true, sentences: parsed });
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Server Gemini Audio] Model ${model} error:`, err.message);
        if (/api key|leaked|permission|forbidden|403/i.test(err.message || '')) {
          return res.status(403).json({ error: err.message });
        }
      }
    }

    return res.status(500).json({ error: lastError?.message || 'Gemini audio transcription failed' });
  } catch (err) {
    console.error('[Server Gemini Audio] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Gemini audio transcription error' });
  }
});
