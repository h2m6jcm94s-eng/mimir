.PHONY: help install dev up down lint test typecheck build

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install JS and Python dependencies
	pnpm install
	uv sync

up: ## Start local infrastructure (Postgres, Redis, Temporal)
	docker compose -f infra/docker-compose.yml up -d

down: ## Stop local infrastructure
	docker compose -f infra/docker-compose.yml down

dev: up ## Start API + web in dev mode (infra first)
	pnpm dev

lint: ## Run linters
	pnpm lint
	uv run ruff check services

typecheck: ## Run type checks
	pnpm typecheck
	uv run mypy services

test: ## Run unit tests
	pnpm test
	uv run pytest services

test-integration: ## Run integration tests
	pnpm test:integration

build: ## Build all apps/packages
	pnpm build

backup: ## Run 3-2-1 backup of Postgres + LibSQL
	./scripts/backup.sh

restore-test: ## Verify latest backup restores cleanly
	./scripts/restore-test.sh
