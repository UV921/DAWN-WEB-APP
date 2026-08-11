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

- Discord login  
- Daily check-in + “I woke up” timestamp  
- Per-habit & perfect-day streaks  
- Wake-time chart, completion bars, 6-week heatmap  
- Friend circle with invite code  
- Check-ins posted to your Discord channel  
- Bot commands: `/setup`, `/woke`, `/checkin`, `/habit`, `/today`, `/me`, `/streak`, `/board`, `/focus`, `/why`

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
   Turn **on**: Server Members Intent (optional). Slash commands work without Message Content Intent.
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
```

Generate `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 3. Run web + bot (both needed for Discord)

```bash
# Terminal 1 — web
npm run build && npm run start
# or: npm run dev

# Terminal 2 — Discord bot (reminders + /commands)
npm run bot
```

Open [http://127.0.0.1:3066](http://127.0.0.1:3066) → **Continue with Discord** (same Discord account you use in the server).

### How channel vs DM works

| What | Where it goes | How to enable |
|------|----------------|---------------|
| Check-in embeds | Study **channel** | Circle channel ID, or Goals channel ID, or `DISCORD_CHANNEL_ID` |
| Reminder pings | Channel and/or **DM** | Goals → Reminders → destination **Channel / DM / Both**, turn **Discord** on for each reminder |
| `/woke` `/checkin` | In Discord | Bot must be online (`npm run bot`) |

**DM notes:** You must share a server with the Dawn bot, and Discord may require you to allow DMs from server members. First DM can fail until the bot can open a DM channel with you.

**Reminder delivery order:** reminder override channel → your Goals channel ID → circle channel → `DISCORD_CHANNEL_ID` in `.env`.

### 4. Friend / study circle flow

1. Everyone signs in with **Discord** on Dawn  
2. One person creates a circle on **Friends** and shares the invite code  
3. Owner pastes the **study channel ID** on the circle  
4. Web check-ins post embeds to that channel  
5. In Discord you can use:
   - `/setup` — button onboarding (why, wake, sleep, focus…)
   - `/track ping_time:06:00 board_time:08:00` — morning board channel
   - `/join` — join board · `/ping` — DM everyone “are you awake?”
   - Reply in DM → saved to DB / grid / streaks; no reply = not awake
   - `/leaderboard` — who woke + habit ranks (also auto-posts at board_time)
   - `/week` · `/grid` — personal bars + contribution grid
   - `/habit add` · `/woke` · `/checkin` · `/today` · `/setup`



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
