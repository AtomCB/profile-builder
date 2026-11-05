# Profile Builder

A single-page chat app that builds your travel profile through natural conversation. An LLM agent (Google Gemini) interviews you, looks up destinations you mention, and records what it learns in a live profile panel (the "ledger"). Your profile and chat history are saved to a local SQLite database, so they survive reloads.

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
cp .env.example .env.local
```
Open `.env.local` and paste your key:
```
GEMINI_API_KEY=your-key-here
```

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Your key from Google AI Studio. Used only on the server, never sent to the browser. |
| `GEMINI_MODEL` | No | Gemini model ID. Defaults to `gemini-3.6-flash`. If the model is overloaded, rate-limited or unavailable to your key, the app automatically falls back to `gemini-3.5-flash-lite`, then `gemini-3.1-flash-lite`. To check which models your key can use, see https://aistudio.google.com/rate-limit. |
| `DATABASE_PATH` | No | Where to store the SQLite database. Defaults to `data/app.db` in the project folder. |

Next.js reads both `.env.local` and `.env`. Both are gitignored; never commit them. Restart the dev server after changing them.

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000 and start chatting. The layout is built for desktop browsers (at least 1280px wide).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Run the production build (after `npm run build`) |
| `npm test` | Run the unit tests once (Vitest) |
| `npm run test:watch` | Run the unit tests in watch mode |
| `npm run typecheck` | TypeScript check |

## Using the app

### The conversation
- The assistant asks one question at a time and aims for **9 essentials**: home base, passports, dietary restrictions, accessibility needs, travel companions, budget, travel months, pace, and at least 3 interests. The header shows your progress ("4 of 9 essentials").
- Optional details (things to avoid, food preferences, climate, trip length, accommodation, places you've been or want to go) are recorded when they come up.
- Replies are plain text. Whenever the assistant changes your profile, it lists the changes at the end of the reply, e.g. `+ Interests: temples (inferred)`.
- While a reply is streaming, input is disabled and a **Stop** button appears. Small badges show what the assistant did, such as "Looked up Kyoto" or "Updated profile".
- If a reply fails, an error box appears under it with **Retry**. Your profile is never lost.
- It only discusses your travel profile and the destinations below, and will politely steer other topics (itineraries, bookings, general questions) back.

### Destinations and inference
- The assistant has destination data for 5 places only: **Kyoto, Lisbon, Marrakech, Reykjavík and Cape Town**.
- When you mention one of these, it looks it up and fills in likely preferences right away, such as interests the place is known for, a budget tier, or travel months. These appear as dashed amber chips marked **inferred**. Confirm them in chat to make them stated.
- For any other place it will say it has no information about it, and won't guess. It still records the place in your travel history if you've been there or want to go (marked "no data"), along with anything you said explicitly.
- Visa guidance covers US, UK, Canadian, Australian, Indian and German passports. It is illustrative only: always confirm with official government sources.

### The ledger (profile panel)
- **Constraints (hard):** home base, passports, dietary restrictions, accessibility needs. These are only recorded from what you say, never inferred.
- **Preferences (soft):** companions, budget, travel months, pace, interests. These may be inferred.
- **Optional:** avoid, food preferences, climate, trip length, accommodation.
- **Places:** trips you've taken or want to take.
- "Not asked yet" means the assistant hasn't covered a field; "None" means you said you have none.
- Recently changed items briefly get an orange outline.
- Click **✕** on any item to remove it. Removed items are remembered, so the assistant won't suggest them again unless you state them yourself.

### Coming back and starting over
- Reloading the page restores your chat and profile, and the assistant greets you with a "Welcome back" that picks up at the next missing essential.
- **Start over** (top right) clears your chat history and profile after a confirmation. It's disabled while a reply is streaming.
- To wipe everything manually, stop the server and delete the database: `rm -rf data/`. A fresh one is created on the next start.

## How it works

1. The page is server-rendered from the database, so your profile and chat appear immediately.
2. Sending a message POSTs to `/api/chat`. The response streams back as Server-Sent Events: text tokens, tool activity, live profile snapshots, and a final done or error event.
3. On the server, the agent loop calls Gemini with two tools:
   - `getDestinationInfo` reads the hardcoded data for the 5 destinations.
   - `updateProfile` applies validated profile changes.

   It can make up to 5 rounds of tool calls per reply. The system prompt includes the current profile, the missing essentials and anything you've rejected.
4. Profile changes go through a single validated reducer that enforces the rules: hard constraints can't be inferred, rejected items aren't re-inferred, duplicates merge. It's shared by the agent and the UI.
5. Clicking ✕ POSTs to `/api/profile`. The item disappears immediately and comes back with a "Try again" message if saving fails.
6. Transient Gemini errors are retried automatically, falling back through the model chain.

See [`PLAN.md`](./PLAN.md) for the full design (data model, agent rules, API lifecycle) and [`SPEC.md`](./SPEC.md) for the original brief.

## Project structure
```
src/
  app/              page, loading skeleton, theme (globals.css), API routes: chat, profile, reset
  components/
    ui/             primitives: Button, IconButton, Chip, icons, feedback (Alert, Toast, Spinner, Skeleton, ProgressBar)
    chat/           ChatPanel, MessageItem, Composer
    profile/        ProfilePanel (the ledger)
  hooks/            useChat (streaming, stop, retry), useProfile (live updates, rejections), useToast, useAutoScroll
  lib/
    profile/        schema, ops, reducer, completeness, display formatting
    destinations/   hardcoded destination data and lookup
    llm/            Gemini client, model fallback, tools, system prompt, agent loop, error mapping
    db/             node:sqlite connection and repositories
    sse/            Server-Sent Events encode and parse
    chat/           shared types
```

## Tests
`npm test` runs the unit tests for the critical logic:
- the profile reducer and its rules
- completeness
- schemas
- destination lookup and data checks
- the database layer (in memory)
- the SSE parser
- opening messages
- display formatting
- the agent loop, driven by a scripted fake model so no API key is needed

The LLM itself is not tested.

## Troubleshooting

| Symptom | Fix |
|---|---|
| A raw technical message appears under the friendly error | That's Gemini's actual error, shown only in development (`npm run dev`) to help debugging. |
| "Gemini is under heavy demand" | Every model in the fallback chain is overloaded. Wait a minute and press Retry, or set `GEMINI_MODEL` to another model. |
| "Rate limit reached" | Free-tier quota hit. Wait a minute and press Retry. Daily quotas reset at midnight Pacific time. |
| "API key is missing" or "was rejected" | Check `GEMINI_API_KEY` in `.env.local` (no quotes or spaces), then restart `npm run dev`. |
| "None of the configured models are available" | Your key can't use any model in the chain. Set `GEMINI_MODEL` in `.env.local` to a model listed for your project at https://aistudio.google.com/rate-limit and restart. |
| "Couldn't reach the server" | The dev server stopped or restarted. Check the terminal, then press Retry. |
| "Couldn't start over" | Restart the dev server and try again. In development the toast includes the underlying error. |
| `node:sqlite` not found / engine warnings | You're not on Node 24. Run `nvm use` or install Node 24. |
| `ExperimentalWarning: SQLite` in the console | Harmless. `node:sqlite` is still flagged experimental by Node. |
| Fonts look different | IBM Plex is loaded from Google Fonts in the browser. Offline, the app falls back to system fonts. |
| Port 3000 in use | `npm run dev -- -p 3001` |

## Privacy note
Data on Gemini's free tier may be used by Google to improve its products. Don't enter sensitive personal information. Your profile and chat history are stored only in the local database (`data/app.db` by default), which is gitignored.

## Tech stack
Next.js 16 (App Router) · React 19 · TypeScript 5.9 · Tailwind CSS v4 · Zod 4 · `node:sqlite` · `@google/genai` · Vitest
