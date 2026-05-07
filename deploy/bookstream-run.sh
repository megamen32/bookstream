#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="/home/roomhacker/PycharmProjects/bookstream"
MODE_FILE="${BOOKSTREAM_MODE_FILE:-$PROJECT_DIR/.zscripts/service.mode}"
NEXT_BIN="$PROJECT_DIR/node_modules/.bin/next"
PROD_SERVER="$PROJECT_DIR/.next/standalone/server.js"

read_mode() {
	if [ ! -f "$MODE_FILE" ]; then
		printf 'prod\n'
		return 0
	fi

	local mode
	mode="$(tr -d '[:space:]' < "$MODE_FILE")"
	if [ -z "$mode" ]; then
		printf 'prod\n'
		return 0
	fi

	printf '%s\n' "$mode"
}

MODE="$(read_mode)"

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"

cd "$PROJECT_DIR"

case "$MODE" in
	dev)
		export NODE_ENV=development
		if [ ! -x "$NEXT_BIN" ]; then
			echo "[bookstream] missing $NEXT_BIN, run 'make deps'" >&2
			exit 1
		fi
		echo "[bookstream] mode=dev host=$HOSTNAME port=$PORT"
		exec "$NEXT_BIN" dev -p "$PORT" --hostname "$HOSTNAME"
		;;
	prod)
		export NODE_ENV=production
		if [ ! -f "$PROD_SERVER" ]; then
			echo "[bookstream] missing $PROD_SERVER, run 'make restart'" >&2
			exit 1
		fi
		echo "[bookstream] mode=prod host=$HOSTNAME port=$PORT"
		exec /usr/bin/node "$PROD_SERVER"
		;;
	*)
		echo "[bookstream] invalid mode '$MODE' in $MODE_FILE" >&2
		exit 1
		;;
esac
