# Dawn Discord bot (Northflank). Website stays on Vercel.
FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
ENV NODE_ENV=production
CMD ["npx", "tsx", "bot/index.ts"]
