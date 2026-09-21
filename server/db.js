import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[DB] WARNING: DATABASE_URL is not defined in .env. Database operations will fail.');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 25000
});

// Handle idle pool client errors (e.g. Neon serverless resets idle connection) without crashing
pool.on('error', (err) => {
  console.warn('[DB Pool Idle Client Warning]', err.message);
});

export async function query(text, params, retries = 2) {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    if (retries > 0 && (err.message?.includes('timeout') || err.message?.includes('Connection terminated') || err.message?.includes('ECONNRESET'))) {
      console.warn(`[DB Query Retry] Retrying query due to: ${err.message}`);
      await new Promise(r => setTimeout(r, 800));
      return query(text, params, retries - 1);
    }
    console.error('[DB Query Error]', { text, error: err.message });
    throw err;
  }
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'zen_salt_2026').digest('hex');
}

/**
 * Initialize all database tables and seed default settings, plans, and admin account
 */
export async function initDb() {
  console.log('[DB] Initializing PostgreSQL schema on Neon...');

  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      plan_id VARCHAR(50) DEFAULT 'free',
      daily_quota INT DEFAULT 5,
      monthly_quota INT DEFAULT 50,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(255) PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otps (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(10) NOT NULL,
      type VARCHAR(50) DEFAULT 'signup',
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      attempts INT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plans (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price NUMERIC(10,2) DEFAULT 0,
      billing_cycle VARCHAR(50) DEFAULT 'month',
      short_desc TEXT,
      features JSONB DEFAULT '[]'::jsonb,
      daily_limit INT DEFAULT 5,
      monthly_limit INT DEFAULT 50,
      is_default_free BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subject VARCHAR(255),
      message TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      reply_heading VARCHAR(255),
      reply_message TEXT,
      replied_by VARCHAR(255),
      replied_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(100),
      plan_id VARCHAR(50),
      plan_name VARCHAR(100),
      price NUMERIC(10,2),
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blogs (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL,
      meta_title VARCHAR(255),
      meta_desc TEXT,
      keywords TEXT,
      featured_image TEXT,
      status VARCHAR(50) DEFAULT 'published',
      views INT DEFAULT 0,
      published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_templates (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id VARCHAR(100) NOT NULL,
      custom_config JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, template_id)
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(100) NOT NULL,
      user_id INT,
      day_date DATE NOT NULL,
      generation_count INT DEFAULT 1,
      UNIQUE(ip_address, day_date)
    );

    CREATE TABLE IF NOT EXISTS visitor_logs (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(100) NOT NULL,
      country VARCHAR(100) DEFAULT 'Unknown',
      country_code VARCHAR(10) DEFAULT 'UN',
      landed_url TEXT NOT NULL,
      user_agent TEXT,
      device_type VARCHAR(50) DEFAULT 'Desktop',
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      user_email VARCHAR(255),
      user_name VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_visitor_logs_created ON visitor_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_visitor_logs_ip ON visitor_logs(ip_address);
    CREATE INDEX IF NOT EXISTS idx_visitor_logs_user ON visitor_logs(user_id);
  `;

  await query(ddl);

  // Seed default plans if table is empty
  const plansCount = await query('SELECT COUNT(*) FROM plans');
  if (parseInt(plansCount.rows[0].count) === 0) {
    console.log('[DB] Seeding default plans...');
    const defaultPlans = [
      {
        id: 'free',
        name: 'Free Starter',
        price: 0,
        billing_cycle: 'month',
        short_desc: 'Full 60 FPS studio with AI video enhancement. 3 video exports per day.',
        features: JSON.stringify([
          { text: '3 Video captions per day', included: true },
          { text: 'All 16 Viral & Luxury Presets', included: true },
          { text: 'Whisper AI high-accuracy transcription', included: true },
          { text: '60 FPS GPU lossless export', included: true },
          { text: 'AI Video Quality Enhancement (HD+)', included: true },
          { text: 'Full Granular Customizer Studio', included: true }
        ]),
        daily_limit: 3,
        monthly_limit: 30,
        is_default_free: true
      },
      {
        id: 'creator-pro',
        name: 'Creator Pro',
        price: 19,
        billing_cycle: 'month',
        short_desc: 'For YouTubers, TikTokers & agencies seeking maximum watch time.',
        features: JSON.stringify([
          { text: '50 Video captions per day', included: true },
          { text: 'All 16 Viral & Luxury Presets', included: true },
          { text: 'Full Granular Customizer Studio', included: true },
          { text: 'Buttery Smooth 60 FPS 1080p Export', included: true },
          { text: 'AI Video Quality Enhancement (HD+)', included: true },
          { text: 'Priority Processing Speed', included: true }
        ]),
        daily_limit: 50,
        monthly_limit: 500,
        is_default_free: false
      },
      {
        id: 'agency-elite',
        name: 'Agency Elite',
        price: 49,
        billing_cycle: 'month',
        short_desc: 'High-volume production powerhouse for video editors & social agencies.',
        features: JSON.stringify([
          { text: 'Unlimited Video Captions', included: true },
          { text: 'All Presets + Custom Brand Font Uploads', included: true },
          { text: 'Lossless 4K & 1080p 60 FPS Export', included: true },
          { text: 'Multi-Language Translation (90+ Languages)', included: true },
          { text: 'Team Account & Custom API Access', included: true },
          { text: '24/7 Priority Support & VIP Onboarding', included: true }
        ]),
        daily_limit: 9999,
        monthly_limit: 99999,
        is_default_free: false
      }
    ];

    for (const p of defaultPlans) {
      await query(
        `INSERT INTO plans (id, name, price, billing_cycle, short_desc, features, daily_limit, monthly_limit, is_default_free)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.price, p.billing_cycle, p.short_desc, p.features, p.daily_limit, p.monthly_limit, p.is_default_free]
      );
    }
  }

  // Seed default admin user
  const adminCheck = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (adminCheck.rows.length === 0) {
    console.log('[DB] Seeding default administrator account...');
    const adminPasswordHash = hashPassword('7940');
    await query(
      `INSERT INTO users (name, username, email, password_hash, role, plan_id, daily_quota, monthly_quota)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (username) DO NOTHING`,
      ['Super Admin', 'abdullah', 'abdullah@zencaption.ai', adminPasswordHash, 'admin', 'agency-elite', 99999, 999999]
    );
  }

  // Seed default site settings
  const defaultSettings = [
    { key: 'site_name', value: 'Zen Caption' },
    { key: 'site_title', value: 'Free AI Caption Generator & Auto Subtitle Maker for Video - Zen Caption' },
    { key: 'site_logo', value: '' },
    { key: 'site_favicon', value: '' },
    { key: 'meta_desc', value: 'Add accurate captions to videos for free with our Auto Subtitle Generator. Automatically transcribe speech to text, generate viral subtitles for TikTok, Instagram Reels & YouTube Shorts. 100% free, no watermark, no sign-up needed.' },
    { key: 'meta_keywords', value: 'free caption generator video tool, free caption generator tool, auto subtitle generator online, Free AI Instagram Caption Generator for Real Estate, free captions generator customizable, real estate video caption generator, customizable caption generator free, free video caption tool, free subtitle maker no watermark, free caption generator, free caption video, free video subtitle generator, auto caption generator free, add captions to video free, no watermark caption generator, free subtitles generator for video, AI caption generator free, free auto subtitles, Hormozi captions free, viral reels captions free, tiktok subtitles generator free, instagram reels captions generator, youtube shorts auto subtitle, speech to text video subtitle, automatic subtitle generator online free, free closed caption tool, video subtitle maker free, transcribe video free, online video captioner, whisper ai captions free, dynamic word highlight captions, dual font video subtitles, client side video captioning, caption video online free no watermark, kapwing alternative free, veed alternative free, auto subtitle generator 99% accurate, ai caption generator for video free, hardcode subtitles to video free, burned in captions generator, mp4 subtitle generator online, mov caption generator free, zen caption tool, zen caption, zen caption ai, zencaption, free caption tool' },
    { key: 'og_image', value: 'https://zencaption.online/default-blog-cover.jpg' },
    { key: 'og_title', value: 'Free AI Caption Generator & Auto Subtitle Maker for Video - Zen Caption' },
    { key: 'og_desc', value: 'Add accurate captions to videos for free with our Auto Subtitle Generator. Automatically transcribe speech to text, generate viral subtitles for TikTok, Instagram Reels & YouTube Shorts. 100% free, no watermark.' },
    { key: 'json_ld', value: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': 'Zen Caption - Free AI Caption Generator & Auto Subtitle Maker',
      'alternateName': [
        'Zen Caption Tool',
        'Auto Subtitle Generator',
        'Free AI Instagram Caption Generator for Real Estate',
        'Customizable Free Captions Generator'
      ],
      'url': 'https://zencaption.online',
      'applicationCategory': 'MultimediaApplication',
      'operatingSystem': 'All',
      'description': 'Add accurate captions to videos for free with our Auto Subtitle Generator. Transcribe speech to text, generate viral subtitles for TikTok, Instagram Reels & YouTube Shorts. 100% free, no watermark, no sign-up needed.',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD'
      },
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': '4.9',
        'ratingCount': '134',
        'reviewCount': '134',
        'bestRating': '5',
        'worstRating': '1'
      },
      'review': [
        {
          '@type': 'Review',
          'author': { '@type': 'Person', 'name': 'David Miller' },
          'datePublished': '2026-09-19',
          'reviewBody': 'Phenomenal free AI caption generator! Burned animated dual-font subtitles into my Instagram Reels in seconds with zero watermark.',
          'reviewRating': { '@type': 'Rating', 'ratingValue': '5', 'bestRating': '5', 'worstRating': '1' }
        },
        {
          '@type': 'Review',
          'author': { '@type': 'Person', 'name': 'Sarah Jenkins' },
          'datePublished': '2026-09-17',
          'reviewBody': 'The best free captions generator customizable for real estate walkthroughs and short-form video. Accurate Whisper AI transcription.',
          'reviewRating': { '@type': 'Rating', 'ratingValue': '5', 'bestRating': '5', 'worstRating': '1' }
        }
      ],
      'featureList': [
        'Free AI Instagram Caption Generator for Real Estate',
        'Customizable Free Caption Generator',
        'Free AI Caption Generator',
        'Auto Subtitle Generator',
        'Offline Whisper AI Speech-to-Text Transcription',
        '100% Free with No Watermark',
        'Hormozi Dual-Font Caption Styles',
        'Kinetic Text Animations',
        'Client-Side Private Processing'
      ]
    }, null, 2) },
    { key: 'header_scripts', value: '' },
    { key: 'footer_scripts', value: '' }
  ];

  for (const s of defaultSettings) {
    await query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [s.key, s.value]
    );
  }

  // Cleanup expired sessions and used/expired OTPs
  try {
    await query('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
    await query('DELETE FROM otps WHERE expires_at < CURRENT_TIMESTAMP OR used = TRUE');
  } catch (cleanErr) {
    // Non-critical background cleanup
  }

  console.log('[DB] PostgreSQL initialization complete.');
}
