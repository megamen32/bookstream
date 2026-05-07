SHELL := /bin/bash

PROJECT_DIR := /home/roomhacker/PycharmProjects/bookstream
SERVICE_NAME := bookstream.service
SERVICE_FILE_SRC := $(PROJECT_DIR)/deploy/bookstream.service
SERVICE_FILE_DST := /etc/systemd/system/$(SERVICE_NAME)
DATABASE_URL ?= file:$(PROJECT_DIR)/db/custom.db

.PHONY: help deps prisma build restart reload status logs install-service stop start

help:
	@echo "Available targets:"
	@echo "  make restart         - install deps, apply Prisma schema, build, reload systemd, restart service"
	@echo "  make deps            - install project dependencies"
	@echo "  make prisma          - generate Prisma client and apply schema to the current database"
	@echo "  make build           - build production Next.js standalone bundle"
	@echo "  make install-service - copy deploy/bookstream.service to /etc/systemd/system and enable it"
	@echo "  make start           - start $(SERVICE_NAME)"
	@echo "  make stop            - stop $(SERVICE_NAME)"
	@echo "  make status          - show service status"
	@echo "  make logs            - tail service logs"

deps:
	@cd $(PROJECT_DIR) && \
	if command -v bun >/dev/null 2>&1; then \
		echo "[deps] bun install"; \
		bun install; \
	else \
		echo "[deps] npm install"; \
		npm install; \
	fi

prisma:
	@cd $(PROJECT_DIR) && \
	echo "[prisma] generate"; \
	npx prisma generate && \
	echo "[prisma] db push -> $(DATABASE_URL)"; \
	DATABASE_URL='$(DATABASE_URL)' npx prisma db push

build:
	@cd $(PROJECT_DIR) && \
	echo "[build] next build"; \
	if command -v bun >/dev/null 2>&1; then \
		bun run build; \
	else \
		npm run build; \
	fi

install-service:
	@set -e; \
	echo "[service] install $(SERVICE_NAME)"; \
	if command -v sudo >/dev/null 2>&1; then \
		sudo -n cp "$(SERVICE_FILE_SRC)" "$(SERVICE_FILE_DST)" || sudo cp "$(SERVICE_FILE_SRC)" "$(SERVICE_FILE_DST)"; \
		sudo -n systemctl daemon-reload || sudo systemctl daemon-reload; \
		sudo -n systemctl enable "$(SERVICE_NAME)" || sudo systemctl enable "$(SERVICE_NAME)"; \
	else \
		cp "$(SERVICE_FILE_SRC)" "$(SERVICE_FILE_DST)"; \
		systemctl daemon-reload; \
		systemctl enable "$(SERVICE_NAME)"; \
	fi

restart: deps prisma build
	@set -e; \
	echo "[service] daemon-reload"; \
	if command -v sudo >/dev/null 2>&1; then \
		sudo -n systemctl daemon-reload >/dev/null 2>&1 || true; \
		sudo -n systemctl restart "$(SERVICE_NAME)" >/dev/null 2>&1 || sudo systemctl restart "$(SERVICE_NAME)"; \
	else \
		systemctl restart "$(SERVICE_NAME)"; \
	fi; \
	echo "[service] status"; \
	systemctl --no-pager --full status "$(SERVICE_NAME)" | sed -n '1,20p'

reload:
	@set -e; \
	echo "[service] reload"; \
	if command -v sudo >/dev/null 2>&1; then \
		sudo -n systemctl daemon-reload >/dev/null 2>&1 || true; \
		sudo -n systemctl reload "$(SERVICE_NAME)" >/dev/null 2>&1 || sudo systemctl reload "$(SERVICE_NAME)"; \
	else \
		systemctl reload "$(SERVICE_NAME)"; \
	fi

start:
	@set -e; \
	echo "[service] start"; \
	if command -v sudo >/dev/null 2>&1; then \
		sudo -n systemctl start "$(SERVICE_NAME)" >/dev/null 2>&1 || sudo systemctl start "$(SERVICE_NAME)"; \
	else \
		systemctl start "$(SERVICE_NAME)"; \
	fi

stop:
	@set -e; \
	echo "[service] stop"; \
	if command -v sudo >/dev/null 2>&1; then \
		sudo -n systemctl stop "$(SERVICE_NAME)" >/dev/null 2>&1 || sudo systemctl stop "$(SERVICE_NAME)"; \
	else \
		systemctl stop "$(SERVICE_NAME)"; \
	fi

status:
	@systemctl --no-pager --full status "$(SERVICE_NAME)"

logs:
	@journalctl -u "$(SERVICE_NAME)" -n 200 -f
