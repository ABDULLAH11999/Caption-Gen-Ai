// Production Express & API Server for Zen AI Caption Studio (Render Web Service)
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initDb, query } from './server/db.js';
import { seedBlogs } from './server/seedBlogs.js';
import { apiRouter } from './server/apiRouter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 10000;

const app = express();

// Production Security Headers Middleware (A+ Grade on SecurityHeaders.com)
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()');
  res.setHeader('Content-Security-Policy', "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https: https://fonts.googleapis.com; font-src 'self' data: https: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https: wss: blob: data:; worker-src 'self' blob: data:; frame-ancestors 'self';");
  next();
});

// Enable CORS & JSON parsing
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount REST API
app.use('/api', apiRouter);

// Dynamic sitemap.xml generator for Google Search Console & SEO indexing
app.get('/sitemap.xml', async (req, res) => {
  try {
    const host = req.headers.host || '';
    const baseUrl = process.env.SITE_URL || (host && !host.includes('localhost') ? `https://${host}` : 'https://zencaption.online');

    let blogRows = [];
    try {
      const blogsRes = await query("SELECT slug, published_at FROM blogs WHERE status = 'published' ORDER BY id ASC");
      blogRows = blogsRes.rows || [];
    } catch (dbErr) {
      console.warn('[Sitemap] Database query failed, serving static sitemap:', dbErr.message);
    }

    // If DB returned rows, build dynamic XML
    if (blogRows.length > 0) {
      const staticRoutes = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/app', priority: '0.95', changefreq: 'daily' },
        { url: '/blog', priority: '0.90', changefreq: 'daily' },
        { url: '/about', priority: '0.70', changefreq: 'monthly' },
        { url: '/contact', priority: '0.70', changefreq: 'monthly' },
        { url: '/terms', priority: '0.50', changefreq: 'yearly' },
        { url: '/cookies', priority: '0.50', changefreq: 'yearly' }
      ];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      for (const route of staticRoutes) {
        xml += `  <url>\n    <loc>${baseUrl}${route.url}</loc>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n  </url>\n`;
      }

      for (const blog of blogRows) {
        const lastmod = new Date(blog.published_at || Date.now()).toISOString().split('T')[0];
        xml += `  <url>\n    <loc>${baseUrl}/blog/${blog.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>\n`;
      }

      xml += `</urlset>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.send(xml);
    }

    // Fallback to static sitemap file
    const staticSitemap = path.join(__dirname, 'public', 'sitemap.xml');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.sendFile(staticSitemap);
  } catch (err) {
    console.error('Failed to generate sitemap.xml:', err);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    const staticSitemap = path.join(__dirname, 'public', 'sitemap.xml');
    res.sendFile(staticSitemap);
  }
});

// Explicit Favicon routes to guarantee proper content-types for Googlebot and browsers
app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/x-icon');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const distIco = path.join(DIST_DIR, 'favicon.ico');
  if (fs.existsSync(distIco)) return res.sendFile(distIco);
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

app.get('/favicon.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const distSvg = path.join(DIST_DIR, 'favicon.svg');
  if (fs.existsSync(distSvg)) return res.sendFile(distSvg);
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

app.get(['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const distPng = path.join(DIST_DIR, 'apple-touch-icon.png');
  if (fs.existsSync(distPng)) return res.sendFile(distPng);
  res.sendFile(path.join(__dirname, 'public', 'apple-touch-icon.png'));
});

// Serve compiled static assets from dist
app.use(express.static(DIST_DIR, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.includes('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// SPA Fallback for all other HTML routes
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Initialize database and start listening
async function startServer() {
  try {
    await initDb();
    await seedBlogs();
  } catch (err) {
    console.error('[Server] DB init error:', err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Zen Caption AI] Enterprise SaaS server running on port ${PORT}`);
  });
}

startServer();
