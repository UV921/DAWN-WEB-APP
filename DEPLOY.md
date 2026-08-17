# Dawn — deploy (Vercel web + Northflank bot)

Railway’s free credit ends and the bot process dies. Discord bots cannot run on Vercel (serverless). Use this split:

| Piece | Where | Cost | Auto on push? |
|-------|--------|------|----------------|
| Website + APIs | **Vercel** | Free | Yes |
| Discord bot | **Northflank** | Free sandbox, always-on | Yes |
| Database | **Neon** (Postgres) | Free | Shared by both |

Northflank’s free plan is **always-on** (no sleep). That is why study-hour tracking and morning DMs keep working.

**Send now** on the website is a Vercel API (`POST /api/discord/send-todos`). The Northflank bot is only slash commands, DMs, and the scheduled daily ping.

Until the new host is live, run the bot on your computer: `npm run bot`.

---

## 0. One schema change for production

Locally you can keep SQLite. **Before deploy**, in `prisma/schema.prisma` set:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Commit that change for production. (Or switch early and use Neon for local + prod.)

---

## 1. Create free Postgres (Neon)

1. Go to https://neon.tech → sign up  
2. Create project **dawn**  
3. Copy the connection string (`postgresql://...`)  
4. Put it in local `.env` (and later in Vercel + Northflank):

```bash
DATABASE_URL="postgresql://USER:PASS@HOST/neondb?sslmode=require"
```

5. With `provider = "postgresql"`:

```bash
npx prisma db push
```

---

## 2. Put code on GitHub

```bash
git init
git add .
git commit -m "Prepare Dawn for Vercel + Northflank"
# create empty repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/dawn.git
git branch -M main
git push -u origin main
```

Do **not** commit `.env`.

---

## 3. Deploy web on Vercel

1. https://vercel.com → **Add New Project** → import the GitHub repo  
2. Framework: Next.js (auto)  
3. Environment variables (Production):

```
NEXTAUTH_URL=https://YOUR-PROJECT.vercel.app
NEXTAUTH_SECRET=paste-a-long-random-string
DATABASE_URL=same-neon-url-as-above
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_CHANNEL_ID=...
DISCORD_STUDY_VOICE_IDS=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
AI_PROVIDER=gemini
```

4. Deploy → copy the live URL  

5. Discord Developer Portal → OAuth2 → Redirects → **add**:

```
https://YOUR-PROJECT.vercel.app/api/auth/callback/discord
```

Also set `NEXTAUTH_URL` to that exact URL (no trailing slash).

---

## 4. Deploy bot on Northflank (free, always-on)

Do **not** use Render / Koyeb free web services — they sleep, Discord disconnects, study hours stop.

1. Open https://northflank.com → sign up with GitHub (Developer / Sandbox plan).  
2. **Create project** → name it `dawn`.  
3. **Create service** → **Deployment** from the same GitHub repo.  
4. Build & start:

```
Build command:  npm install && npx prisma generate
Start command:  npx tsx bot/index.ts
```

   Dockerfile settings (if you pick **Dockerfile** instead of Buildpack):

   - Build type: **Dockerfile**
   - BuildKit: **on**
   - Build context: `/`
   - Dockerfile location: `/Dockerfile`

5. Add the **same env vars** as Vercel (`DATABASE_URL`, Discord keys, `NEXTAUTH_URL` = your Vercel URL).  
   Northflank will set `PORT` — the bot already serves a health check on that port.

6. Deploy. Logs should show:

```
Dawn bot online as YourBot#1234
Health server on :8080
Study voice tracking ready
```

7. After each `git push` to `main`, Northflank rebuilds the bot and Vercel rebuilds the site.

8. You can delete the Railway service. Leave Neon + Vercel as they are.

---

## 5. After every update

```bash
git add .
git commit -m "your message"
git push
```

- Vercel redeploys the website  
- Northflank redeploys the bot  

The bot cannot live on Vercel itself.

---

## Temporary: bot on your laptop

If Northflank is not set up yet:

```bash
npm run bot
```

Keep that terminal open. Study hours and slash commands work only while it runs.

---

## Checklist

- [ ] `provider = "postgresql"` committed  
- [ ] Neon `DATABASE_URL` + `npx prisma db push`  
- [ ] GitHub repo pushed  
- [ ] Vercel live + Discord OAuth redirect updated  
- [ ] Northflank bot online (logs show logged in)  
- [ ] Discord login works on the Vercel URL  
- [ ] Bot slash command works in your server  
- [ ] Railway service deleted (optional)  
