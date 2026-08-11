#!/bin/bash
set -e
cd "$(dirname "$0")"

# kill old Dawn servers so only one runs
for p in 3000 3001 3010 3055 3066; do
  for pid in $(lsof -tiTCP:$p -sTCP:LISTEN 2>/dev/null); do
    kill -9 "$pid" 2>/dev/null || true
  done
done

export NEXTAUTH_URL=http://127.0.0.1:3066
if [ ! -f .env ]; then
  cp .env.example .env
fi
# keep URL in sync
perl -pi -e 's|^NEXTAUTH_URL=.*|NEXTAUTH_URL=http://127.0.0.1:3066|' .env

npx prisma db push
npm run build
echo ""
echo "Open: http://127.0.0.1:3066/login"
echo "Click: Demo as You"
echo ""
npm run start
