.PHONY: setup scrape dev build up down logs

setup: scrape

scrape:
	npm run scrape

dev:
	npm run dev

build:
	npm run build

up:
	docker compose up -d

up-build:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

dev-docker:
	docker compose -f docker-compose.dev.yml up -d

install:
	npm install
