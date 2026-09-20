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

// Dynamic sitemap.xml generator for SEO search ranking & indexing
app.get('/sitemap.xml', async (req, res) => {
  try {
    const blogsRes = await query("SELECT slug, published_at FROM blogs WHERE status = 'published'");
    const baseUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    const staticRoutes = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/templates', priority: '0.9', changefreq: 'weekly' },
      { url: '/pricing', priority: '0.9', changefreq: 'weekly' },
      { url: '/blog', priority: '0.8', changefreq: 'daily' },
      { url: '/about', priority: '0.7', changefreq: 'monthly' },
      { url: '/contact', priority: '0.7', changefreq: 'monthly' },
      { url: '/terms', priority: '0.5', changefreq: 'yearly' },
      { url: '/cookies', priority: '0.5', changefreq: 'yearly' }
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    for (const route of staticRoutes) {
      xml += `  <url>\n    <loc>${baseUrl}${route.url}</loc>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n  </url>\n`;
    }

    // All 30+ SEO Blog Articles
    for (const blog of blogsRes.rows) {
      const lastmod = new Date(blog.published_at || Date.now()).toISOString().split('T')[0];
      xml += `  <url>\n    <loc>${baseUrl}/blog/${blog.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    xml += `</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Failed to generate sitemap.xml:', err);
    res.status(500).send('Error generating sitemap');
  }
});

// Explicit Favicon routes to guarantee browser loads the Orange Diamond icon
app.get(['/favicon.ico', '/favicon.svg'], (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(DIST_DIR, 'favicon.svg'));
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
