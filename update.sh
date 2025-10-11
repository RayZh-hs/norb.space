#!/bin/bash
set -e

cd /var/www/norb.space

git pull origin main
pnpm install --frozen-lockfile
pnpm run build
pm2 reload norb-space

echo "Deployment successful!"