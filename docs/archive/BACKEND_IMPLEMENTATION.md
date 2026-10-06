# Backend Implementation Plan — CareerAiHub

## Overview

Add a Node.js/Express API backend alongside the existing React frontend on the same VPS.
Both run as Docker containers behind Nginx Proxy Manager (NPM).

- Frontend: `careraihub.com` → NPM → port 8081 (existing, unchanged)
- Backend API: `api.careraihub.com` → NPM → port 4000 (new)

---

## Current Architecture

```
Internet → Nginx Proxy Manager → port 8081 → career-ai-hub container (React/Nginx)
```

## Target Architecture

```
Internet → Nginx Proxy Manager → port 8081 → career-ai-hub container (React/Nginx)
                               → port 4000 → career-ai-api container (Node/Express)
```

Both containers on the same `npm_net` Docker network. Frontend calls `https://api.careraihub.com/*`.

---

## Phase 1 — API Key Security (Do First — Critical)

**Problem**: Anthropic, Gemini, OpenAI keys are in the browser bundle. Anyone can steal them.

**Fix**: Frontend calls our backend proxy. Backend holds the real keys, calls Anthropic.

### Backend route

```
POST /api/llm/chat
Body: { messages: [...], maxTokens: 1200, provider: "anthropic" }
Response: { content: "..." }
```

### Frontend change

In `src/lib/ai.jsx`, replace direct `fetch('https://api.anthropic.com/...')` with:
```js
fetch('https://api.careraihub.com/api/llm/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
  body: JSON.stringify({ messages, maxTokens, provider })
})
```

### Backend implementation (`api/routes/llm.js`)

```js
router.post('/chat', requireAuth, rateLimiter, async (req, res) => {
  const { messages, maxTokens, provider } = req.body;
  // Call Anthropic/Gemini/OpenAI with server-side keys
  // Return { content }
});
```

**Keys move**: Remove all `VITE_*_API_KEY` from frontend `.env`. Add to backend `.env` only.

---

## Phase 2 — Rate Limiting & Abuse Prevention

**Problem**: One user can make unlimited AI calls, drain API budget.

**Implementation**: `express-rate-limit` + per-user tracking in Redis or Supabase.

```js
// Free tier: 20 AI calls per hour per user
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user.id,
  message: { error: 'Rate limit reached. Try again in an hour.' }
});
```

Limits by feature:
| Feature | Free limit/day |
|---|---|
| Resume Scan | 5 |
| ATS Rebuild | 3 |
| Mock Interview | 10 |
| Cover Letter | 5 |
| All others | 20 combined |

---

## Phase 3 — Job Search (Real Data)

**Problem**: JobSearch shows hardcoded fake listings.

**Fix**: Backend fetches from JSearch API (RapidAPI), caches for 1 hour.

### Backend route

```
GET /api/jobs/search?title=Software+Engineer&location=Singapore&page=1
```

### Implementation

```js
router.get('/search', requireAuth, async (req, res) => {
  const { title, location, page = 1 } = req.query;
  const cacheKey = `jobs:${title}:${location}:${page}`;

  // Check cache first (Redis or in-memory)
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  // Fetch from JSearch
  const response = await fetch(`https://jsearch.p.rapidapi.com/search?query=${title}+in+${location}&page=${page}`, {
    headers: {
      'X-RapidAPI-Key': process.env.JSEARCH_API_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
    }
  });
  const data = await response.json();
  
  await cache.set(cacheKey, data, 3600); // cache 1 hour
  res.json(data);
});
```

### Frontend change (`src/features/JobSearch/JobSearch.jsx`)

Replace hardcoded mock data with:
```js
const res = await fetch(`https://api.careraihub.com/api/jobs/search?title=${title}&location=${location}`);
const { data } = await res.json();
// data = array of real jobs with title, company, salary, applyUrl, logo
```

**Cost**: JSearch free tier = 100 req/month (testing). $10/month for production.

---

## Phase 4 — Market Intel (Real Salary Data)

**Problem**: MarketIntel shows hardcoded static text.

**Fix**: Backend calls Claude with role + market → structured salary benchmarks. Cache per role/market pair for 24 hours.

### Backend route

```
GET /api/market/salary?role=Software+Engineer&market=Singapore&level=Senior
```

### Implementation

```js
router.get('/salary', requireAuth, async (req, res) => {
  const { role, market, level } = req.query;
  const cacheKey = `salary:${role}:${market}:${level}`;
  
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const result = await callLLM(`Market salary data for ${level} ${role} in ${market}. 
    Return JSON: { p25, median, p75, top10pct, currency, demandTrend, hiringInsight, negotiationTip }`);
  
  await cache.set(cacheKey, result, 86400); // cache 24 hours
  res.json(result);
});
```

---

## Phase 5 — PDF Format Preservation

**Problem**: After ATS rebuild, resume loses original formatting.

**Fix**: Backend runs LibreOffice headless to convert PDF → DOCX → apply edits → return DOCX.

### VPS setup (one time)

```bash
apt install libreoffice
```

### Backend route

```
POST /api/resume/convert
Body: multipart/form-data { file: <pdf_file> }
Response: { docxBase64: "...", docxUrl: "..." }
```

### Implementation

```js
const { exec } = require('child_process');
const multer = require('multer');

router.post('/convert', requireAuth, upload.single('file'), async (req, res) => {
  const inputPath = req.file.path; // e.g. /tmp/upload_abc.pdf
  const outputDir = '/tmp/';
  
  exec(`libreoffice --headless --convert-to docx --outdir ${outputDir} ${inputPath}`, (err) => {
    if (err) return res.status(500).json({ error: 'Conversion failed' });
    const docxPath = inputPath.replace('.pdf', '.docx');
    const docxBase64 = fs.readFileSync(docxPath).toString('base64');
    res.json({ docxBase64 });
    // cleanup temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(docxPath);
  });
});
```

---

## Phase 6 — Email Notifications (Future)

**Problem**: No way to send users reminders or progress emails.

### Backend setup

```bash
npm install nodemailer node-cron
```

### Cron jobs

```js
// Weekly progress email — every Monday 9am SGT
cron.schedule('0 1 * * 1', async () => {
  const users = await getActiveUsers();
  for (const user of users) {
    await sendProgressEmail(user);
  }
});

// Interview reminder — 24h before saved interview date
cron.schedule('0 * * * *', checkUpcomingInterviews);
```

---

## Backend Project Structure

```
career-ai-api/
├── src/
│   ├── index.js              # Express app entry
│   ├── middleware/
│   │   ├── auth.js           # Verify Supabase JWT
│   │   ├── rateLimiter.js    # Per-user rate limits
│   │   └── cache.js          # In-memory or Redis cache
│   ├── routes/
│   │   ├── llm.js            # AI proxy routes
│   │   ├── jobs.js           # JSearch integration
│   │   ├── market.js         # Salary data
│   │   └── resume.js         # PDF conversion
│   └── lib/
│       ├── anthropic.js      # Anthropic client
│       ├── gemini.js         # Gemini client
│       └── email.js          # Nodemailer
├── Dockerfile
├── .env                      # ALL secret keys live here only
└── package.json
```

---

## Docker Setup

### `career-ai-api/Dockerfile`

```dockerfile
FROM node:20-alpine

# LibreOffice for PDF conversion (Phase 5)
RUN apk add --no-cache libreoffice

WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY src ./src

EXPOSE 4000
CMD ["node", "src/index.js"]
```

### Updated `docker-compose.yml` (root, both services)

```yaml
version: '3.8'

services:
  career-ai-hub:
    build: .
    container_name: career-ai-hub
    restart: unless-stopped
    ports:
      - "127.0.0.1:8081:80"
    env_file: .env
    networks:
      - npm_net

  career-ai-api:
    build: ./career-ai-api
    container_name: career-ai-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:4000:4000"
    env_file: ./career-ai-api/.env
    networks:
      - npm_net

networks:
  npm_net:
    external: true
```

### Backend `.env` (never commit this)

```
PORT=4000
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
OPENAI_API_KEY=...
JSEARCH_API_KEY=...
SUPABASE_URL=https://ruibdsvrcctxgxctaxwe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # service role, not anon
JWT_SECRET=...                  # same as Supabase JWT secret
```

---

## Nginx Proxy Manager — New Proxy Host

Add a second proxy host in NPM dashboard:

| Field | Value |
|---|---|
| Domain | `api.careraihub.com` |
| Scheme | `http` |
| Forward Hostname | `127.0.0.1` |
| Forward Port | `4000` |
| SSL | Let's Encrypt (same as frontend) |

---

## Auth Middleware (reuse Supabase JWT)

Frontend already has a Supabase JWT in `user.token`. Backend verifies it:

```js
// middleware/auth.js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
};
```

No new auth system needed — reuses existing Supabase login.

---

## Implementation Order

| Phase | Priority | Effort | Impact |
|---|---|---|---|
| 1 — API Key Security | 🔴 Critical | 1 day | Fixes live security vulnerability |
| 2 — Rate Limiting | 🔴 High | 0.5 day | Prevents budget drain |
| 3 — Real Job Search | 🟡 Medium | 1 day | Core feature becomes real |
| 4 — Market Intel | 🟡 Medium | 0.5 day | AI-powered, already proven pattern |
| 5 — PDF Conversion | 🟢 Nice to have | 1 day | Resume format preservation |
| 6 — Email Notifications | 🟢 Future | 2 days | Retention/engagement |

**Total to Phase 4 (production-ready)**: ~3 days of development.

---

## Deployment Steps (when ready)

```bash
# On VPS
git pull origin main

# Build and start both containers
docker-compose up -d --build

# Verify both running
docker ps

# Check API health
curl http://localhost:4000/health

# Add api.careraihub.com in NPM → done
```
