SHELL := /bin/bash

PROJECT_DIR := /home/roomhacker/PycharmProjects/bookstream
SERVICE_NAME := bookstream.service
SERVICE_FILE_SRC := $(PROJECT_DIR)/deploy/bookstream.service
SERVICE_FILE_DST := /etc/systemd/system/$(SERVICE_NAME)
DATABASE_URL ?= file:$(PROJECT_DIR)/db/custom.db
SERVICE_MODE_FILE := $(PROJECT_DIR)/.zscripts/service.mode
DEV_PORT ?= 3000

.PHONY: help deps prisma build restart restartdev reload status logs install-service service-sync stop start

help:
	@echo "Available targets:"
	@echo "  make restart         - switch service to prod, install deps, apply Prisma schema, build, sync unit, restart service"
	@echo "  make restartdev      - switch service to dev hot reload mode on port $(DEV_PORT) and restart it"
	@echo "  make deps            - install project dependencies"
	@echo "  make prisma          - generate Prisma client and apply schema to the current database"
	@echo "  make build           - build production Next.js standalone bundle"
	@echo "  make service-sync    - copy deploy/bookstream.service to /etc/systemd/system and reload systemd"
	@echo "  make install-service - sync deploy/bookstream.service and enable it"
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

service-sync:
	@set -e; \
	mkdir -p "$(PROJECT_DIR)/.zscripts"; \
	if [ ! -f "$(SERVICE_MODE_FILE)" ]; then \
		printf 'prod\n' >"$(SERVICE_MODE_FILE)"; \
	fi; \
	echo "[service] sync $(SERVICE_NAME)"; \
	if command -v sudo >/dev/null 2>&1; then \
		sudo -n cp "$(SERVICE_FILE_SRC)" "$(SERVICE_FILE_DST)" || sudo cp "$(SERVICE_FILE_SRC)" "$(SERVICE_FILE_DST)"; \
		sudo -n systemctl daemon-reload || sudo systemctl daemon-reload; \
	else \
		cp "$(SERVICE_FILE_SRC)" "$(SERVICE_FILE_DST)"; \
		systemctl daemon-reload; \
	fi

install-service: service-sync
	@set -e; \
	echo "[service] enable $(SERVICE_NAME)"; \
	if command -v sudo >/dev/null 2>&1; then \
		sudo -n systemctl enable "$(SERVICE_NAME)" || sudo systemctl enable "$(SERVICE_NAME)"; \
	else \
		systemctl enable "$(SERVICE_NAME)"; \
	fi

restart: deps prisma service-sync
	@set -e; \
	mkdir -p "$(PROJECT_DIR)/.zscripts"; \
	printf 'prod\n' >"$(SERVICE_MODE_FILE)"; \
	echo "[service] mode -> prod"; \
	if command -v sudo >/dev/null 2>&1; then \
		sudo -n systemctl stop "$(SERVICE_NAME)" >/dev/null 2>&1 || sudo systemctl stop "$(SERVICE_NAME)"; \
	else \
		systemctl stop "$(SERVICE_NAME)"; \
	fi; \
	$(MAKE) build; \
	if command -v sudo >/dev/null 2>&1; then \
		sudo -n systemctl start "$(SERVICE_NAME)" >/dev/null 2>&1 || sudo systemctl start "$(SERVICE_NAME)"; \
	else \
		systemctl start "$(SERVICE_NAME)"; \
	fi; \
	echo "[service] status"; \
	systemctl --no-pager --full status "$(SERVICE_NAME)" | sed -n '1,20p'

restartdev: deps prisma service-sync
	@set -e; \
	mkdir -p "$(PROJECT_DIR)/.zscripts"; \
	printf 'dev\n' >"$(SERVICE_MODE_FILE)"; \
	echo "[service] mode -> dev"; \
	if command -v sudo >/dev/null 2>&1; then \
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
	@set -e; \
	mode="prod"; \
	if [ -f "$(SERVICE_MODE_FILE)" ]; then \
		mode="$$(tr -d '[:space:]' < "$(SERVICE_MODE_FILE)")"; \
	fi; \
	if [ -z "$$mode" ]; then \
		mode="prod"; \
	fi; \
	echo "[service] mode: $$mode"; \
	systemctl --no-pager --full status "$(SERVICE_NAME)"

logs:
	@journalctl -u "$(SERVICE_NAME)" -n 200 -f
