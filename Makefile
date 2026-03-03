.PHONY: install dev test lint typecheck run worker localstack deploy docs clean

# ── Setup ──────────────────────────────────────────────────────────────────────
install:
	npm ci

# ── Development ────────────────────────────────────────────────────────────────
dev:
	docker-compose -f docker/docker-compose.yml up -d localstack localstack-init otel-collector
	@sleep 5
	ORCHESTRATOR_MODE=api npm run start:dev

worker:
	ORCHESTRATOR_MODE=worker npm run start:dev

# ── LocalStack (local AWS) ─────────────────────────────────────────────────────
localstack:
	docker-compose -f docker/docker-compose.yml up localstack -d
	@sleep 3
	@echo "Bootstrapping SQS and DynamoDB..."
	aws --endpoint-url=http://localhost:4566 sqs create-queue \
		--queue-name orchestrator-jobs \
		--attributes VisibilityTimeout=300 2>/dev/null || true
	aws --endpoint-url=http://localhost:4566 sqs create-queue \
		--queue-name orchestrator-dlq 2>/dev/null || true
	aws --endpoint-url=http://localhost:4566 dynamodb create-table \
		--table-name orchestrator-runs \
		--attribute-definitions \
			AttributeName=run_id,AttributeType=S \
			AttributeName=sk,AttributeType=S \
			AttributeName=status,AttributeType=S \
			AttributeName=created_at,AttributeType=S \
		--key-schema \
			AttributeName=run_id,KeyType=HASH \
			AttributeName=sk,KeyType=RANGE \
		--global-secondary-indexes \
			'[{"IndexName":"status-createdAt-index","KeySchema":[{"AttributeName":"status","KeyType":"HASH"},{"AttributeName":"created_at","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}}]' \
		--provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 2>/dev/null || true
	@echo "LocalStack ready."

# ── Quality ────────────────────────────────────────────────────────────────────
lint:
	npm run lint

lint-fix:
	npm run format

typecheck:
	npx tsc --noEmit

# ── Tests ──────────────────────────────────────────────────────────────────────
test:
	npx jest --testPathPattern=unit -v

test-integration:
	npx jest --testPathPattern=integration -v

test-e2e:
	npx jest --config ./test/jest-e2e.json -v

test-all:
	npx jest --coverage

# ── Docker ─────────────────────────────────────────────────────────────────────
build:
	docker build -f docker/Dockerfile -t orchestrator:local .

up:
	docker-compose -f docker/docker-compose.yml up --build

down:
	docker-compose -f docker/docker-compose.yml down

# ── Infra ──────────────────────────────────────────────────────────────────────
cdk-synth:
	cd infra/cdk && npm ci && npx cdk synth

cdk-deploy:
	cd infra/cdk && npx cdk deploy --all --require-approval never

cdk-destroy:
	cd infra/cdk && npx cdk destroy --all

# ── Docs ───────────────────────────────────────────────────────────────────────
docs:
	cd docs && npm install && npm run dev

docs-build:
	cd docs && npm run build

# ── Utilities ──────────────────────────────────────────────────────────────────
clean:
	rm -rf dist/ node_modules/ coverage/ .nest/
