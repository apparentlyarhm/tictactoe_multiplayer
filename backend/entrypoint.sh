#!/bin/sh
set -e

echo "[INIT] Starting Nakama entrypoint..."
echo "[INIT] Waiting for DB"

until /nakama/nakama migrate up --database.address "$NAKAMA_DATABASE_ADDRESS"
do
  echo "[INIT] DB not ready, retrying in 2s..."
  sleep 2
done

echo "[INIT] Migration complete, starting Nakama..."

exec /nakama/nakama \
  --database.address "$NAKAMA_DATABASE_ADDRESS" \
  --logger.level "WARN" \
  --session.token_expiry_sec 7200 \
  --session.refresh_token_expiry_sec 7200 \
  --socket.server_key "$SERVER_KEY" \
  --console.password "$CONSOLE_PASSWORD"