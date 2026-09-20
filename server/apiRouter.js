import express from 'express';
import crypto from 'node:crypto';
import { query, hashPassword } from './db.js';
import { 
  sendEmail, 
  generateOtpEmailHtml, 
  generatePurchaseConfirmationEmailHtml, 
  generateContactReplyEmailHtml 
} from './emailService.js';

export const apiRouter = express.Router();

apiRouter.use(express.json());

// Auth Middleware
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
      req.user = sessionRes.rows[0];
      req.token = token;
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
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

// Step 1: Sign up request -> Send OTP Email
apiRouter.post('/auth/signup', async (req, res) => {
  const { name, username, email, password } = req.body;

  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  // Check existing username or email
  const existing = await query(
    'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
    [cleanUsername, cleanEmail]
  );

  if (existing.rows.length > 0) {
    if (existing.rows[0].username === cleanUsername) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  // Generate 6-digit OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  // Store OTP
  await query(
    'INSERT INTO otps (email, code, type, expires_at) VALUES ($1, $2, $3, $4)',
    [cleanEmail, otpCode, 'signup', expiresAt]
  );

  // Send professional themed OTP email
  const html = generateOtpEmailHtml({ name, otpCode });
  await sendEmail({
    to: cleanEmail,
    subject: `${otpCode} is your Zen Caption AI verification code`,
    html
  });

  res.json({
    success: true,
    message: `Verification code sent to ${cleanEmail}`,
    email: cleanEmail
  });
});

// Step 2: Verify OTP -> Create Account & Issue Months-Long Session
apiRouter.post('/auth/verify-otp', async (req, res) => {
  const { email, code, name, username, password } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }
  const cleanEmail = email.toLowerCase().trim();

  const otpRes = await query(
    `SELECT id FROM otps 
     WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
     ORDER BY id DESC LIMIT 1`,
    [cleanEmail, code.toString().trim()]
  );

  if (otpRes.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid or expired verification code.' });
  }

  // Mark OTP used
  await query('UPDATE otps SET used = TRUE WHERE id = $1', [otpRes.rows[0].id]);

  // Create user
  const passwordHash = hashPassword(password);
  const cleanUsername = username.toLowerCase().trim();

  const newUserRes = await query(
    `INSERT INTO users (name, username, email, password_hash, role, plan_id, daily_quota, monthly_quota)
     VALUES ($1, $2, $3, $4, 'user', 'free', 5, 50)
     RETURNING id, name, username, email, role, plan_id, daily_quota, monthly_quota`,
    [name, cleanUsername, cleanEmail, passwordHash]
  );

  const newUser = newUserRes.rows[0];

  // Create 90-day persistent session token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days (months session)

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

// Sign In
apiRouter.post('/auth/signin', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/Email and Password are required.' });
  }

  const cleanId = identifier.toLowerCase().trim();
  const passwordHash = hashPassword(password);

  const userRes = await query(
    `SELECT id, name, username, email, role, plan_id, daily_quota, monthly_quota, is_active
     FROM users
     WHERE (email = $1 OR username = $1) AND password_hash = $2`,
    [cleanId, passwordHash]
  );

  if (userRes.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid username/email or password.' });
  }

  const user = userRes.rows[0];
  if (!user.is_active) {
    return res.status(403).json({ error: 'Account is suspended. Please contact support.' });
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

// Contact Request Submission
apiRouter.post('/public/contact', async (req, res) => {
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

// Purchase Request Submission
apiRouter.post('/public/purchase', async (req, res) => {
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

// Quota Check
apiRouter.post('/public/quota-check', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const today = new Date().toISOString().split('T')[0];

  if (req.user) {
    const dailyLimit = req.user.daily_quota || 5;
    const monthlyLimit = req.user.monthly_quota || 100;
    const usageRes = await query(
      `SELECT generation_count FROM usage_logs WHERE user_id = $1 AND day_date = $2`,
      [req.user.user_id, today]
    );
    const count = usageRes.rows[0]?.generation_count || 0;
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

  // Guest IP Check
  const guestLimit = 3; // Default free guest limit per day
  const usageRes = await query(
    `SELECT generation_count FROM usage_logs WHERE ip_address = $1 AND day_date = $2`,
    [ip, today]
  );
  const count = usageRes.rows[0]?.generation_count || 0;

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

// Quota Consume
apiRouter.post('/public/quota-consume', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user ? req.user.user_id : null;

  await query(
    `INSERT INTO usage_logs (ip_address, user_id, day_date, generation_count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (ip_address, day_date)
     DO UPDATE SET generation_count = usage_logs.generation_count + 1,
                   user_id = COALESCE(EXCLUDED.user_id, usage_logs.user_id)`,
    [ip, userId, today]
  );

  res.json({ success: true, consumed: true });
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

  res.json({
    totalUsers: parseInt(usersCount.rows[0].count),
    totalContacts: parseInt(contactsCount.rows[0].count),
    pendingPurchases: parseInt(pendingPurchases.rows[0].count),
    totalBlogs: parseInt(blogsCount.rows[0].count),
    todayGenerations: parseInt(todayUsage.rows[0].total)
  });
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
