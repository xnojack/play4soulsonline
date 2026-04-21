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

# Test commands
test:
	npm test

test-ui:
	npm run test:ui

test-watch:
	npm run test:watch

test-debug:
	npm run test:debug

test-headless:
	npm run test:headless

test-basic:
	npm run test:basic

test-cards:
	npm run test:cards

test-mechanics:
	npm run test:mechanics

test-regression:
	npm run test:regression

test-full:
	npm run test:full

test-report:
	npm run test:report

test-validate:
	./tests/validate.sh
