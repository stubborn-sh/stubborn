-- Repeatable migration: seed realistic demo data
-- Idempotent: deletes all demo-managed rows first (respecting FK order)

DELETE FROM webhook_executions;
DELETE FROM webhooks;
DELETE FROM version_tags;
DELETE FROM deployments;
DELETE FROM verifications;
DELETE FROM contracts;
DELETE FROM applications;
DELETE FROM environments;

-- ============================================================
-- Environments
-- ============================================================
INSERT INTO environments (name, description, display_order, production)
VALUES
    ('dev',        'Development environment',  1, FALSE),
    ('staging',    'Staging / QA environment',  2, FALSE),
    ('production', 'Production environment',    3, TRUE);

-- ============================================================
-- Applications
-- ============================================================
INSERT INTO applications (name, description, owner)
VALUES
    ('order-service',        'Manages customer orders',           'team-orders'),
    ('payment-service',      'Processes payments and refunds',    'team-payments'),
    ('notification-service', 'Sends emails, SMS & push',          'team-notifications'),
    ('inventory-service',    'Tracks warehouse stock levels',     'team-inventory'),
    ('user-service',         'Authentication & user profiles',    'team-identity'),
    ('api-gateway',          'Edge proxy & request routing',      'team-platform');

-- ============================================================
-- Contracts
-- ============================================================

-- order-service v1.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.0.0', 'shouldReturnOrder.yml',
     E'request:\n  method: GET\n  url: /api/orders/1\nresponse:\n  status: 200\n  headers:\n    Content-Type: application/json\n  body:\n    id: 1\n    status: CREATED\n    total: 99.99',
     'application/x-spring-cloud-contract+yaml',
     'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.0.0', 'shouldCreateOrder.yml',
     E'request:\n  method: POST\n  url: /api/orders\n  headers:\n    Content-Type: application/json\n  body:\n    customerId: 42\n    items:\n      - productId: 100\n        quantity: 2\nresponse:\n  status: 201\n  body:\n    id: 1\n    status: CREATED',
     'application/x-spring-cloud-contract+yaml',
     'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3');

-- order-service v1.1.0 (same content as v1.0.0 — demonstrates hash dedup)
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.1.0', 'shouldReturnOrder.yml',
     E'request:\n  method: GET\n  url: /api/orders/1\nresponse:\n  status: 200\n  headers:\n    Content-Type: application/json\n  body:\n    id: 1\n    status: CREATED\n    total: 99.99',
     'application/x-spring-cloud-contract+yaml',
     'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.1.0', 'shouldCreateOrder.yml',
     E'request:\n  method: POST\n  url: /api/orders\n  headers:\n    Content-Type: application/json\n  body:\n    customerId: 42\n    items:\n      - productId: 100\n        quantity: 2\nresponse:\n  status: 201\n  body:\n    id: 1\n    status: CREATED',
     'application/x-spring-cloud-contract+yaml',
     'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.1.0', 'shouldListOrders.yml',
     E'request:\n  method: GET\n  url: /api/orders\n  queryParameters:\n    status: CREATED\nresponse:\n  status: 200\n  body:\n    - id: 1\n      status: CREATED\n      total: 99.99',
     'application/x-spring-cloud-contract+yaml',
     'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');

-- order-service v1.2.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'shouldReturnOrder.yml',
     E'request:\n  method: GET\n  url: /api/orders/1\nresponse:\n  status: 200\n  headers:\n    Content-Type: application/json\n  body:\n    id: 1\n    status: CREATED\n    total: 99.99\n    currency: USD',
     'application/x-spring-cloud-contract+yaml',
     'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'shouldCreateOrder.yml',
     E'request:\n  method: POST\n  url: /api/orders\n  headers:\n    Content-Type: application/json\n  body:\n    customerId: 42\n    items:\n      - productId: 100\n        quantity: 2\nresponse:\n  status: 201\n  body:\n    id: 1\n    status: CREATED\n    currency: USD',
     'application/x-spring-cloud-contract+yaml',
     'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'shouldListOrders.yml',
     E'request:\n  method: GET\n  url: /api/orders\n  queryParameters:\n    status: CREATED\nresponse:\n  status: 200\n  body:\n    - id: 1\n      status: CREATED\n      total: 99.99\n      currency: USD',
     'application/x-spring-cloud-contract+yaml',
     'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');

-- payment-service v2.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'payment-service'), '2.0.0', 'shouldProcessPayment.yml',
     E'request:\n  method: POST\n  url: /api/payments\n  headers:\n    Content-Type: application/json\n  body:\n    orderId: 1\n    amount: 99.99\nresponse:\n  status: 201\n  body:\n    id: 1\n    status: COMPLETED',
     'application/x-spring-cloud-contract+yaml',
     'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1');

-- payment-service v2.1.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0', 'shouldProcessPayment.yml',
     E'request:\n  method: POST\n  url: /api/payments\n  headers:\n    Content-Type: application/json\n  body:\n    orderId: 1\n    amount: 99.99\n    currency: USD\nresponse:\n  status: 201\n  body:\n    id: 1\n    status: COMPLETED\n    transactionId: txn-abc-123',
     'application/x-spring-cloud-contract+yaml',
     'a1c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0', 'shouldRefundPayment.yml',
     E'request:\n  method: POST\n  url: /api/payments/1/refund\nresponse:\n  status: 200\n  body:\n    id: 1\n    status: REFUNDED',
     'application/x-spring-cloud-contract+yaml',
     'b1d2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2');

-- notification-service v1.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'notification-service'), '1.0.0', 'shouldSendOrderConfirmation.yml',
     E'request:\n  method: POST\n  url: /api/notifications\n  headers:\n    Content-Type: application/json\n  body:\n    type: ORDER_CONFIRMATION\n    recipient: customer@example.com\n    orderId: 1\nresponse:\n  status: 202\n  body:\n    status: QUEUED',
     'application/x-spring-cloud-contract+yaml',
     'c1e2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2');

-- inventory-service v1.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'inventory-service'), '1.0.0', 'shouldCheckStock.yml',
     E'request:\n  method: GET\n  url: /api/inventory/100\nresponse:\n  status: 200\n  body:\n    productId: 100\n    available: 50',
     'application/x-spring-cloud-contract+yaml',
     'd1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2');

-- inventory-service v1.1.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0', 'shouldCheckStock.yml',
     E'request:\n  method: GET\n  url: /api/inventory/100\nresponse:\n  status: 200\n  body:\n    productId: 100\n    available: 50\n    warehouse: MAIN',
     'application/x-spring-cloud-contract+yaml',
     'e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0', 'shouldReserveStock.yml',
     E'request:\n  method: POST\n  url: /api/inventory/reserve\n  headers:\n    Content-Type: application/json\n  body:\n    productId: 100\n    quantity: 2\nresponse:\n  status: 200\n  body:\n    reserved: true\n    remaining: 48',
     'application/x-spring-cloud-contract+yaml',
     'f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8d9e0f1a2');

-- user-service v3.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'user-service'), '3.0.0', 'shouldReturnUser.yml',
     E'request:\n  method: GET\n  url: /api/users/42\nresponse:\n  status: 200\n  body:\n    id: 42\n    name: John Doe\n    email: john@example.com',
     'application/x-spring-cloud-contract+yaml',
     'a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3');

-- user-service v3.1.0 (same content hash as v3.0.0 — demonstrates hash dedup)
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'user-service'), '3.1.0', 'shouldReturnUser.yml',
     E'request:\n  method: GET\n  url: /api/users/42\nresponse:\n  status: 200\n  body:\n    id: 42\n    name: John Doe\n    email: john@example.com',
     'application/x-spring-cloud-contract+yaml',
     'a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'user-service'), '3.1.0', 'shouldAuthenticateUser.yml',
     E'request:\n  method: POST\n  url: /api/auth/login\n  headers:\n    Content-Type: application/json\n  body:\n    email: john@example.com\n    password: secret\nresponse:\n  status: 200\n  body:\n    token: eyJhbGciOiJIUzI1NiJ9.demo\n    expiresIn: 3600',
     'application/x-spring-cloud-contract+yaml',
     'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8d9e0f1a2b3');

-- api-gateway v1.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'api-gateway'), '1.0.0', 'shouldRouteToOrders.yml',
     E'request:\n  method: GET\n  url: /orders/1\n  headers:\n    Authorization: Bearer token-123\nresponse:\n  status: 200\n  body:\n    id: 1\n    status: CREATED',
     'application/x-spring-cloud-contract+yaml',
     'c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3');

-- ============================================================
-- Verifications
-- ============================================================

-- order-service v1.2.0 verified against payment-service v2.1.0: SUCCESS
INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0',
     (SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0',
     'SUCCESS', 'All 3 contract tests passed');

-- order-service v1.2.0 verified against notification-service v1.0.0: SUCCESS
INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0',
     (SELECT id FROM applications WHERE name = 'notification-service'), '1.0.0',
     'SUCCESS', 'All 1 contract tests passed');

-- order-service v1.1.0 verified against payment-service v2.0.0: SUCCESS
INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.1.0',
     (SELECT id FROM applications WHERE name = 'payment-service'), '2.0.0',
     'SUCCESS', 'All 2 contract tests passed');

-- api-gateway v1.0.0 verified against order-service v1.2.0: SUCCESS
INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'api-gateway'), '1.0.0',
     (SELECT id FROM applications WHERE name = 'order-service'), '1.2.0',
     'SUCCESS', 'All 1 contract tests passed');

-- api-gateway v1.0.0 verified against user-service v3.1.0: SUCCESS
INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'api-gateway'), '1.0.0',
     (SELECT id FROM applications WHERE name = 'user-service'), '3.1.0',
     'SUCCESS', 'All 1 contract tests passed');

-- inventory-service v1.1.0 verified against order-service v1.1.0: FAILED
INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0',
     (SELECT id FROM applications WHERE name = 'order-service'), '1.1.0',
     'FAILED', 'Contract shouldReserveStock.yml failed: expected status 200 but got 400 — missing required field "warehouse"');

-- inventory-service v1.1.0 verified against order-service v1.2.0: SUCCESS
INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0',
     (SELECT id FROM applications WHERE name = 'order-service'), '1.2.0',
     'SUCCESS', 'All 2 contract tests passed');

-- ============================================================
-- Deployments
-- ============================================================

-- production
INSERT INTO deployments (application_id, environment, version)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'),   'production', '1.2.0'),
    ((SELECT id FROM applications WHERE name = 'payment-service'), 'production', '2.1.0'),
    ((SELECT id FROM applications WHERE name = 'user-service'),    'production', '3.1.0'),
    ((SELECT id FROM applications WHERE name = 'api-gateway'),     'production', '1.0.0');

-- staging (all latest)
INSERT INTO deployments (application_id, environment, version)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'),        'staging', '1.2.0'),
    ((SELECT id FROM applications WHERE name = 'payment-service'),      'staging', '2.1.0'),
    ((SELECT id FROM applications WHERE name = 'notification-service'), 'staging', '1.0.0'),
    ((SELECT id FROM applications WHERE name = 'inventory-service'),    'staging', '1.1.0'),
    ((SELECT id FROM applications WHERE name = 'user-service'),         'staging', '3.1.0'),
    ((SELECT id FROM applications WHERE name = 'api-gateway'),          'staging', '1.0.0');

-- dev (all latest + inventory)
INSERT INTO deployments (application_id, environment, version)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'),        'dev', '1.2.0'),
    ((SELECT id FROM applications WHERE name = 'payment-service'),      'dev', '2.1.0'),
    ((SELECT id FROM applications WHERE name = 'notification-service'), 'dev', '1.0.0'),
    ((SELECT id FROM applications WHERE name = 'inventory-service'),    'dev', '1.1.0'),
    ((SELECT id FROM applications WHERE name = 'user-service'),         'dev', '3.1.0'),
    ((SELECT id FROM applications WHERE name = 'api-gateway'),          'dev', '1.0.0');

-- ============================================================
-- Version Tags
-- ============================================================
INSERT INTO version_tags (application_id, version, tag)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'),   '1.2.0', 'latest'),
    ((SELECT id FROM applications WHERE name = 'order-service'),   '1.2.0', 'stable'),
    ((SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0', 'latest');

-- ============================================================
-- Webhooks
-- ============================================================
INSERT INTO webhooks (application_id, event_type, url, headers, enabled)
VALUES
    ((SELECT id FROM applications WHERE name = 'notification-service'),
     'contract_published',
     'https://hooks.example.com/stubborn/notifications',
     '{"X-Webhook-Secret": "demo-secret-token"}',
     TRUE);
