# Profile Builder

A single-page chat app that builds your travel profile through natural conversation. An LLM agent (Google Gemini) interviews you. Your profile fills in live in a side panel and is saved to a local SQLite database, so it survives reloads.

## Quick start (about 5 minutes)

### 1. Prerequisites
- **Node.js 24** (required: the app uses Node's built-in `node:sqlite`).
  - With nvm: `nvm install && nvm use` (reads `.nvmrc`)
  - Without nvm: install the 24.x LTS from https://nodejs.org
  - Check: `node -v` should print `v24.x.x`
- A Google account (for a free Gemini API key)

### 2. Install
```bash
git clone https://github.com/AtomCB/profile-builder.git
cd profile-builder
npm install
```

### 3. Get a free Gemini API key
1. Go to https://aistudio.google.com/apikey and sign in with your Google account.
2. Click **Create API key**. If asked, let it create a new Google Cloud project. No billing is needed for the free tier.
3. Copy the key.

### 4. Configure environment
```bash
cp .env.example .env
```
Open `.env` and paste your key:
```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.8-flash
```

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Your key from Google AI Studio. Server-side only, never sent to the browser. |
| `GEMINI_MODEL` | No | Gemini model ID. Defaults to `gemini-3.8-flash`. Must be available to your key on the free tier. Check https://aistudio.google.com/rate-limit and pick another Flash model if needed. |

`.env` is gitignored. Never commit it.

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000 and start chatting.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm test` | Run unit tests (Vitest) |
| `npm run typecheck` | TypeScript check |

## Using the app
- Answer the assistant's questions. It aims for 9 essentials: home base, passports, dietary restrictions, accessibility needs, travel companions, budget, travel months, pace, and at least 3 interests. Optional details (things to avoid, food preferences, climate, trip length, accommodation, places) are picked up when they come up.
- When you mention a place it knows, the assistant fills in likely preferences right away. These show as dashed amber chips marked **inferred**. Confirm them in chat to make them stated, or click ✕ on any chip to remove it. Removed inferences are remembered and won't be suggested again.
- The assistant has destination data for 5 places only: **Kyoto, Lisbon, Marrakech, Reykjavík and Cape Town**. For anything else it will say it has no information. It still records the place in your travel history if you've been there or want to go.
- Visa guidance covers US, UK, Canadian, Australian, Indian and German passports. It is illustrative only: always confirm with official government sources.
- It only discusses your travel profile and these destinations, and will steer other topics back.

### Resetting
Stop the server and delete the database: `rm -rf data/`. A fresh one is created on the next start.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Rate limit reached" in chat | Free-tier quota hit. Wait a minute and press Retry. Daily quotas reset at midnight Pacific time. |
| "Invalid API key" | Check `GEMINI_API_KEY` in `.env` (no quotes or spaces), then restart `npm run dev`. |
| "Model not found" or permission errors | Your key can't use that model. Set `GEMINI_MODEL` to a Flash model listed for your project at https://aistudio.google.com/rate-limit and restart. |
| `node:sqlite` not found / engine warnings | You're not on Node 24. Run `nvm use` or install Node 24. |
| `ExperimentalWarning: SQLite` in the console | Harmless. `node:sqlite` is still flagged experimental by Node. |
| Port 3000 in use | `npm run dev -- -p 3001` |

## Privacy note
Data on Gemini's free tier may be used by Google to improve its products. Don't enter sensitive personal information. Your profile and chat history are stored only in the local `data/app.db` file.

## Tech stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zod 4 · `node:sqlite` · `@google/genai` · Vitest

See [`PLAN.md`](./PLAN.md) for architecture, data model and agent design, and [`SPEC.md`](./SPEC.md) for the original brief.
