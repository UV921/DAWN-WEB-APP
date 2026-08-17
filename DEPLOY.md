# Dawn — deploy (Vercel web + Northflank bot)

Railway’s free credit ends and the bot process dies. Discord bots cannot run on Vercel (serverless). Use this split:

| Piece | Where | Cost | Auto on push? |
|-------|--------|------|----------------|
| Website + APIs | **Vercel** | Free | Yes |
| Discord bot | **Northflank** (`uv9s-team` / `dawn` / `dawn-web-app`) | Free sandbox, always-on | Yes |
| Database | **Neon** (Postgres) | Free | Shared by both |

**Send now / morning “post today’s tasks” from the website is Vercel**, not the Northflank process. `POST /api/discord/send-todos` uses `DISCORD_BOT_TOKEN` on the Vercel project. The Northflank bot handles slash commands, morning DMs, study voice, and the scheduled daily todo ping.

If a phone still shows an old error after a deploy, it is the Home Screen PWA cache — force-close Dawn and reopen (or Settings → Safari → Clear History for dawn-web-app.vercel.app).

Northflank’s free plan is **always-on** (no sleep). That is why study-hour tracking and morning DMs keep working.

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
NEXTAUTH_URL=https://dawn.uvesh.in
NEXTAUTH_SECRET=paste-a-long-random-string
DATABASE_URL=same-neon-url-as-above
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
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

5. **Google Cloud Console** → APIs & Services → Credentials → your **OAuth 2.0 Client ID** (Web application).

   Google compares the callback **exactly**. Two Vercel hosts are two different URIs. Adding only `dawn.uvesh.in` does **not** allow `dawn-web-app.vercel.app`.

   Authorized JavaScript origins:

   ```
   https://dawn.uvesh.in
   https://dawn-web-app.vercel.app
   ```

   Authorized redirect URIs:

   ```
   https://dawn.uvesh.in/api/auth/callback/google
   https://dawn-web-app.vercel.app/api/auth/callback/google
   ```

   The `redirect_uri=` value in the Google 400 page is the string that must appear in that list.

6. Discord Developer Portal → OAuth2 → Redirects → **add both hosts**:

```
https://dawn.uvesh.in/api/auth/callback/discord
https://dawn-web-app.vercel.app/api/auth/callback/discord
```

Set `NEXTAUTH_URL` to the domain people should use (`https://dawn.uvesh.in`, no trailing slash). Pages on `dawn-web-app.vercel.app` redirect there so Google login starts on the custom domain. `/api/auth/*` is left on the Vercel host so an in-flight Google callback still works.

If you still see `Error 400: redirect_uri_mismatch`, copy the `redirect_uri=` from that Google page and paste it into **Authorized redirect URIs**. Typical misses:

- Added `https://dawn.uvesh.in` but opened `https://dawn-web-app.vercel.app`
- Trailing slash (`.../google/` vs `.../google`)
- `http` vs `https`
- A different OAuth client than the one whose ID is in Vercel `GOOGLE_CLIENT_ID`

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

5. Add the **same env vars** as Vercel (`DATABASE_URL`, Discord keys, `NEXTAUTH_URL` = `https://dawn.uvesh.in`).  
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
- [ ] Vercel live + Discord **and Google** OAuth redirects updated for **both** `dawn.uvesh.in` and `dawn-web-app.vercel.app`  
- [ ] Google / Discord login works on `https://dawn.uvesh.in`  
- [ ] Northflank bot online (logs show logged in)  
- [ ] Bot slash command works in your server  
- [ ] Railway service deleted (optional)  
