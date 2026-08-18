# Dawn

Morning habit tracker with streaks, wake-time graphs, and **Discord friend accountability**.

## Habits

- Sleep early  
- No phone  
- Wake early  
- Gym  
- Reading  
- Custom habits you add 

## Features

- Google or Discord login  
- Daily check-in + “I woke up” timestamp  
- Per-habit & perfect-day streaks  
- Wake-time chart, completion bars, 6-week heatmap  
- Friend circle: invite code, Discord / same-server add, rank board (habits + study hours)  
- Check-ins posted to your Discord channel  
- Bot commands: `/setup`, `/woke`, `/checkin`, `/habit`, `/today`, `/me`, `/streak`, `/board`, `/focus`, `/why`, `/study-room`, `/studied`, `/doing`
- Study hours from marked Discord voice channels (Dawn’s own timer). Join a room and the bot asks what you’re doing (Coding, or write it). You can also start / label a session on Today in the app.

## Setup

### 1. Install & database

```bash
npm install
cp .env.example .env
npx prisma db push
```

### 2. Connect your Discord study server

You need **one Discord Application** (login + bot). Use the server where you already study / share progress.

1. Open [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** (or pick an existing one)
2. **OAuth2 → Redirects** → add:  
   `http://127.0.0.1:3066/api/auth/callback/discord`
3. Copy **Client ID** → `DISCORD_CLIENT_ID`  
   Copy **Client Secret** → `DISCORD_CLIENT_SECRET`
4. **Bot** → Add Bot → **Reset Token** → `DISCORD_BOT_TOKEN`  
   Turn **on**: **Server Voice States** (required for study hours) and Server Members Intent (optional). Slash commands work without Message Content Intent.
5. **OAuth2 → URL Generator**  
   Scopes: `bot` + `applications.commands`  
   Bot permissions: **Send Messages**, **Embed Links**, **Use Application Commands**  
   Open the generated URL → invite the bot into **your study server**
6. In Discord: **User Settings → Advanced → Developer Mode ON**
7. Right‑click your **study progress channel** → **Copy Channel ID** → paste as `DISCORD_CHANNEL_ID`  
   (or paste it in Dawn → **Goals → Channel ID** / **Friends → circle channel**)
8. Right‑click the **server name** → **Copy Server ID** → `DISCORD_GUILD_ID`  
   (makes `/woke` `/checkin` commands appear instantly)

Example `.env` Discord block:

```env
NEXTAUTH_URL=http://127.0.0.1:3066
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...          # your study server
DISCORD_CHANNEL_ID=...        # #study / progress channel
DISCORD_STUDY_VOICE_IDS=...   # optional; or /study-room add
```

Generate `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 2b. Google login (optional, recommended)

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID** → **Web application**
2. Authorized JavaScript origins — every host people open, with **no path**:
   - `http://127.0.0.1:3066`
   - `https://YOUR-PROJECT.vercel.app`
   - `https://YOUR-CUSTOM-DOMAIN` (example: `https://dawn.uvesh.in`)
3. Authorized redirect URIs — Google matches these **character-for-character**. A custom domain does **not** cover `*.vercel.app`:
   - `http://127.0.0.1:3066/api/auth/callback/google`
   - `https://YOUR-PROJECT.vercel.app/api/auth/callback/google`
   - `https://YOUR-CUSTOM-DOMAIN/api/auth/callback/google`
4. Copy Client ID → `GOOGLE_CLIENT_ID`  
   Copy Client secret → `GOOGLE_CLIENT_SECRET`

`Error 400: redirect_uri_mismatch` means the URL in the Google error (`redirect_uri=...`) is missing from that list. Add that exact string. On Vercel, NextAuth sends the **hostname you opened**, so logging in on `*.vercel.app` will not use the custom-domain URI.

Same Google email as Discord will land on the same Dawn account.

### 3. Run web + bot (both needed for Discord)

```bash
# Terminal 1 — web
npm run build && npm run start
# or: npm run dev

# Terminal 2 — Discord bot (reminders + /commands)
npm run bot
```

Open [http://127.0.0.1:3066](http://127.0.0.1:3066) → **Sign up / Sign in** with Google or Discord.

### How channel vs DM works

| What | Where it goes | How to enable |
|------|----------------|---------------|
| Check-in embeds | Study **channel** | Circle channel ID, or Goals channel ID, or `DISCORD_CHANNEL_ID` |
| Reminder pings | Channel and/or **DM** | Goals → Reminders → destination **Channel / DM / Both**, turn **Discord** on for each reminder |
| `/woke` `/checkin` | In Discord | Bot must be online (`npm run bot`) |

**DM notes:** You must share a server with the Dawn bot, and Discord may require you to allow DMs from server members. First DM can fail until the bot can open a DM channel with you.

**Reminder delivery order:** reminder override channel → your Goals channel ID → circle channel → `DISCORD_CHANNEL_ID` in `.env`.

### 4. Friend / study circle flow

**Google friends (code only)**

1. You both sign in with **Google** (Discord is optional)
2. Open **Friends** — your friend code is already there
3. Copy the code or share the link
4. They open Friends, paste your code, tap **Add friend**
5. You’re on the same rank board (habits + study hours)

**Discord extras**

- Same-server people already on Dawn show as one-tap **Add**
- **Join Discord server group** shares one board with the guild
- Owner can paste a study channel ID and **Post to Discord**

The circle **rank board** sorts by habits + study, 7-day habit %, study hours, on-time wakes, or today.

In Discord you can use:
   - `/setup` — button onboarding (why, wake, sleep, focus…)
   - `/track ping_time:06:00 board_time:08:00` — morning board channel
   - `/join` — join board · `/ping` — DM everyone “are you awake?”
   - Reply in DM → saved to DB / grid / streaks; no reply = not awake
   - `/leaderboard` — who woke + habit ranks (also auto-posts at board_time)
   - `/week` · `/grid` — personal bars + contribution grid
   - `/habit add` · `/woke` · `/checkin` · `/today` · `/setup`
   - `/study-room add` — mark a voice channel · `/studied` — your hours
   - Join a study VC → Dawn pings **what are you doing?** · `/doing` to change it



## Scripts

| Command | What it does |
|--------|----------------|
| `npm run dev` | Next.js web app (port 3066) |
| `npm run start` | Production web (port 3066) |
| `npm run bot` | Discord reminders + slash commands |
| `npm run db:push` | Sync Prisma schema to SQLite |
| `npm run db:studio` | Browse data in Prisma Studio |

## Stack

Next.js 15 · NextAuth (Discord) · Prisma + SQLite · Recharts · discord.js
