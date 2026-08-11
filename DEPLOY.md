# Dawn — deploy (Vercel web + Railway bot)

There is **no way** to run the Discord bot on Vercel. Vercel is serverless.
Use this split (both auto-redeploy when you `git push`):

| Piece | Where | Auto on push? |
|-------|--------|----------------|
| Website + APIs | **Vercel** | Yes |
| Discord bot | **Railway** | Yes |
| Database | **Neon** (Postgres) | Shared by both |

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
4. Put it in local `.env` (and later in Vercel + Railway):

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
git commit -m "Prepare Dawn for Vercel + Railway"
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

## 4. Deploy bot on Railway (always-on)

1. https://railway.app → New Project → **Deploy from GitHub** (same repo)  
2. Add the same env vars (`DATABASE_URL`, Discord, `NEXTAUTH_URL` = your Vercel URL)  
3. Start command (if not picked from `railway.toml`):

```bash
npx tsx bot/index.ts
```

4. After each `git push`, Railway rebuilds the bot and Vercel rebuilds the site.

---

## 5. After every update

```bash
git add .
git commit -m "your message"
git push
```

- Vercel redeploys the website  
- Railway redeploys the bot  

That is the practical approach: **one push updates both**. The bot cannot live on Vercel itself.

---

## Optional: everything on Railway

Skip Vercel: two Railway services  
- web: `npx next start -H 0.0.0.0 -p $PORT`  
- bot: `npx tsx bot/index.ts`  
+ Neon Postgres  

---

## Checklist

- [ ] `provider = "postgresql"` committed  
- [ ] Neon `DATABASE_URL` + `npx prisma db push`  
- [ ] GitHub repo pushed  
- [ ] Vercel live + Discord OAuth redirect updated  
- [ ] Railway bot online (logs show logged in)  
- [ ] Discord login works on the Vercel URL  
- [ ] Bot slash command works in your server  
