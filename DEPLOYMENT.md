# Deploying Zen AI Caption Studio to Render (100% Free)

Zen AI Caption Studio is fully configured for seamless deployment on **Render.com**'s free tier.

---

### Method 1: Automatic Blueprint (Easiest - Recommended)

1. Push this repository to **GitHub** or **GitLab**.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Blueprint**.
3. Select your repository.
4. Render will automatically read `render.yaml` and configure:
   - **Service Type**: Static Site (Free)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `./dist`
   - **Routing**: SPA rewrite `/* -> /index.html`
   - **Security Headers**: Cross-Origin-Opener-Policy & Embedder-Policy for fast offline speech decoding.
5. Click **Apply**. Your app will be live with a free `onrender.com` SSL domain in 1-2 minutes!

---

### Method 2: Manual Static Site Setup

1. In Render Dashboard, click **New +** -> **Static Site**.
2. Connect your Git repository.
3. Fill in the following fields:
   - **Name**: `zen-caption-ai-studio`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Under **Redirects/Rewrites**:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: `Rewrite`
5. Click **Create Static Site**.

---

### Method 3: Node Web Service Setup (Alternative)

If you prefer to run it as a Node service on Render:
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
3. Render will launch `server.js` listening on `PORT 10000`.

---

### Environment Variables (Optional)

You can set these in the Render Dashboard or `.env`:
- `VITE_SITE_PASSCODE`: `7940` (Default site access key)
- `VITE_MAX_FILE_SIZE_MB`: `100`
- `VITE_MAX_DURATION_SEC`: `300`
- `VITE_APP_TITLE`: `ZEN CAPTION AI STUDIO`
