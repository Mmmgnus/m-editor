.PHONY: dev build test lint lint-fix format format-check

dev:
	npm run dev

build:
	npm run build

test:
	npm test

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check
