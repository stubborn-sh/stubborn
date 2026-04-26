-- Repeatable migration: seed realistic demo data (H2 compatible)
-- Idempotent: deletes all demo-managed rows first (respecting FK order)

DELETE FROM webhook_executions;
DELETE FROM webhooks;
DELETE FROM git_import_sources;
DELETE FROM maven_import_sources;
DELETE FROM version_tags;
DELETE FROM deployments;
DELETE FROM verifications;
DELETE FROM contract_topics;
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
INSERT INTO applications (name, description, owner, repository_url)
VALUES
    ('order-service',        'Manages customer orders',           'team-orders',         'https://github.com/example/order-service'),
    ('payment-service',      'Processes payments and refunds',    'team-payments',       'https://github.com/example/payment-service'),
    ('notification-service', 'Sends emails, SMS & push',          'team-notifications',  'https://github.com/example/notification-service'),
    ('inventory-service',    'Tracks warehouse stock levels',     'team-inventory',      'https://github.com/example/inventory-service'),
    ('user-service',         'Authentication & user profiles',    'team-identity',       'https://github.com/example/user-service'),
    ('api-gateway',          'Edge proxy & request routing',      'team-platform',       'https://github.com/example/api-gateway');

-- ============================================================
-- Contracts
-- ============================================================

-- order-service v1.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.0.0', 'shouldReturnOrder.yml',
     'request:
  method: GET
  url: /api/orders/1
response:
  status: 200
  headers:
    Content-Type: application/json
  body:
    id: 1
    status: CREATED
    total: 99.99',
     'application/x-spring-cloud-contract+yaml',
     'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.0.0', 'shouldCreateOrder.yml',
     'request:
  method: POST
  url: /api/orders
  headers:
    Content-Type: application/json
  body:
    customerId: 42
    items:
      - productId: 100
        quantity: 2
response:
  status: 201
  body:
    id: 1
    status: CREATED',
     'application/x-spring-cloud-contract+yaml',
     'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3');

-- order-service v1.1.0 (same content as v1.0.0 -- demonstrates hash dedup)
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.1.0', 'shouldReturnOrder.yml',
     'request:
  method: GET
  url: /api/orders/1
response:
  status: 200
  headers:
    Content-Type: application/json
  body:
    id: 1
    status: CREATED
    total: 99.99',
     'application/x-spring-cloud-contract+yaml',
     'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.1.0', 'shouldCreateOrder.yml',
     'request:
  method: POST
  url: /api/orders
  headers:
    Content-Type: application/json
  body:
    customerId: 42
    items:
      - productId: 100
        quantity: 2
response:
  status: 201
  body:
    id: 1
    status: CREATED',
     'application/x-spring-cloud-contract+yaml',
     'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.1.0', 'shouldListOrders.yml',
     'request:
  method: GET
  url: /api/orders
  queryParameters:
    status: CREATED
response:
  status: 200
  body:
    - id: 1
      status: CREATED
      total: 99.99',
     'application/x-spring-cloud-contract+yaml',
     'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');

-- order-service v1.2.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'shouldReturnOrder.yml',
     'request:
  method: GET
  url: /api/orders/1
response:
  status: 200
  headers:
    Content-Type: application/json
  body:
    id: 1
    status: CREATED
    total: 99.99
    currency: USD',
     'application/x-spring-cloud-contract+yaml',
     'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'shouldCreateOrder.yml',
     'request:
  method: POST
  url: /api/orders
  headers:
    Content-Type: application/json
  body:
    customerId: 42
    items:
      - productId: 100
        quantity: 2
response:
  status: 201
  body:
    id: 1
    status: CREATED
    currency: USD',
     'application/x-spring-cloud-contract+yaml',
     'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'shouldListOrders.yml',
     'request:
  method: GET
  url: /api/orders
  queryParameters:
    status: CREATED
response:
  status: 200
  body:
    - id: 1
      status: CREATED
      total: 99.99
      currency: USD',
     'application/x-spring-cloud-contract+yaml',
     'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');

-- order-service v1.3.0-feat on branch feature/payments
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash, branch)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.3.0-feat', 'shouldReturnOrder.yml',
     'request:
  method: GET
  url: /api/orders/1
response:
  status: 200
  headers:
    Content-Type: application/json
  body:
    id: 1
    status: CREATED
    total: 99.99
    currency: USD
    paymentMethod: CARD',
     'application/x-spring-cloud-contract+yaml',
     'f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
     'feature/payments');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash, branch)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.3.0-feat', 'shouldProcessPaymentCallback.yml',
     'request:
  method: POST
  url: /api/orders/1/payment-callback
  headers:
    Content-Type: application/json
  body:
    transactionId: txn-789
    status: COMPLETED
response:
  status: 200
  body:
    id: 1
    status: PAID',
     'application/x-spring-cloud-contract+yaml',
     'a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
     'feature/payments');

-- Verification for branch-specific version (feature/payments)
INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details, branch)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.3.0-feat',
     (SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0',
     'SUCCESS', 'All 2 contract tests passed on feature/payments branch',
     'feature/payments');

-- payment-service v2.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'payment-service'), '2.0.0', 'shouldProcessPayment.yml',
     'request:
  method: POST
  url: /api/payments
  headers:
    Content-Type: application/json
  body:
    orderId: 1
    amount: 99.99
response:
  status: 201
  body:
    id: 1
    status: COMPLETED',
     'application/x-spring-cloud-contract+yaml',
     'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1');

-- payment-service v2.1.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0', 'shouldProcessPayment.yml',
     'request:
  method: POST
  url: /api/payments
  headers:
    Content-Type: application/json
  body:
    orderId: 1
    amount: 99.99
    currency: USD
response:
  status: 201
  body:
    id: 1
    status: COMPLETED
    transactionId: txn-abc-123',
     'application/x-spring-cloud-contract+yaml',
     'a1c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0', 'shouldRefundPayment.yml',
     'request:
  method: POST
  url: /api/payments/1/refund
response:
  status: 200
  body:
    id: 1
    status: REFUNDED',
     'application/x-spring-cloud-contract+yaml',
     'b1d2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2');

-- notification-service v1.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'notification-service'), '1.0.0', 'shouldSendOrderConfirmation.yml',
     'request:
  method: POST
  url: /api/notifications
  headers:
    Content-Type: application/json
  body:
    type: ORDER_CONFIRMATION
    recipient: customer@example.com
    orderId: 1
response:
  status: 202
  body:
    status: QUEUED',
     'application/x-spring-cloud-contract+yaml',
     'c1e2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2');

-- inventory-service v1.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'inventory-service'), '1.0.0', 'shouldCheckStock.yml',
     'request:
  method: GET
  url: /api/inventory/100
response:
  status: 200
  body:
    productId: 100
    available: 50',
     'application/x-spring-cloud-contract+yaml',
     'd1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2');

-- inventory-service v1.1.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0', 'shouldCheckStock.yml',
     'request:
  method: GET
  url: /api/inventory/100
response:
  status: 200
  body:
    productId: 100
    available: 50
    warehouse: MAIN',
     'application/x-spring-cloud-contract+yaml',
     'e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0', 'shouldReserveStock.yml',
     'request:
  method: POST
  url: /api/inventory/reserve
  headers:
    Content-Type: application/json
  body:
    productId: 100
    quantity: 2
response:
  status: 200
  body:
    reserved: true
    remaining: 48',
     'application/x-spring-cloud-contract+yaml',
     'f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8d9e0f1a2');

-- user-service v3.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'user-service'), '3.0.0', 'shouldReturnUser.yml',
     'request:
  method: GET
  url: /api/users/42
response:
  status: 200
  body:
    id: 42
    name: John Doe
    email: john@example.com',
     'application/x-spring-cloud-contract+yaml',
     'a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3');

-- user-service v3.1.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'user-service'), '3.1.0', 'shouldReturnUser.yml',
     'request:
  method: GET
  url: /api/users/42
response:
  status: 200
  body:
    id: 42
    name: John Doe
    email: john@example.com',
     'application/x-spring-cloud-contract+yaml',
     'a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'user-service'), '3.1.0', 'shouldAuthenticateUser.yml',
     'request:
  method: POST
  url: /api/auth/login
  headers:
    Content-Type: application/json
  body:
    email: john@example.com
    password: secret
response:
  status: 200
  body:
    token: eyJhbGciOiJIUzI1NiJ9.demo
    expiresIn: 3600',
     'application/x-spring-cloud-contract+yaml',
     'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8d9e0f1a2b3');

-- api-gateway v1.0.0
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash)
VALUES
    ((SELECT id FROM applications WHERE name = 'api-gateway'), '1.0.0', 'shouldRouteToOrders.yml',
     'request:
  method: GET
  url: /orders/1
  headers:
    Authorization: Bearer token-123
response:
  status: 200
  body:
    id: 1
    status: CREATED',
     'application/x-spring-cloud-contract+yaml',
     'c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3');

-- ============================================================
-- Messaging Contracts
-- ============================================================

-- order-service publishes to order-events topic (v1.2.0)
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash, interaction_type)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'shouldPublishOrderCreated.yml',
     'label: order_created
input:
  triggeredBy: trigger()
outputMessage:
  sentTo: order-events
  body:
    orderId: 1
    status: CREATED
    total: 99.99
    currency: USD
  headers:
    contentType: application/json',
     'application/x-spring-cloud-contract+yaml',
     'e1e2e3e4e5e6e7e8e9e0e1e2e3e4e5e6e7e8e9e0e1e2e3e4e5e6e7e8e9e0e1e2',
     'MESSAGING');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash, interaction_type)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'shouldPublishOrderCancelled.yml',
     'label: order_cancelled
input:
  triggeredBy: trigger()
outputMessage:
  sentTo: order-events
  body:
    orderId: 1
    status: CANCELLED
    reason: customer_request
  headers:
    contentType: application/json',
     'application/x-spring-cloud-contract+yaml',
     'f1f2f3f4f5f6f7f8f9f0f1f2f3f4f5f6f7f8f9f0f1f2f3f4f5f6f7f8f9f0f1f2',
     'MESSAGING');

-- payment-service publishes to payment-events topic (v2.1.0)
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash, interaction_type)
VALUES
    ((SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0', 'shouldPublishPaymentCompleted.yml',
     'label: payment_completed
input:
  triggeredBy: trigger()
outputMessage:
  sentTo: payment-events
  body:
    paymentId: 1
    orderId: 1
    status: COMPLETED
    amount: 99.99
    transactionId: txn-abc-123
  headers:
    contentType: application/json',
     'application/x-spring-cloud-contract+yaml',
     'a1a2a3a4a5a6a7a8a9a0a1a2a3a4a5a6a7a8a9a0a1a2a3a4a5a6a7a8a9a0a1a2',
     'MESSAGING');

INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash, interaction_type)
VALUES
    ((SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0', 'shouldPublishPaymentFailed.yml',
     'label: payment_failed
input:
  triggeredBy: trigger()
outputMessage:
  sentTo: payment-events
  body:
    paymentId: 1
    orderId: 1
    status: FAILED
    reason: insufficient_funds
  headers:
    contentType: application/json',
     'application/x-spring-cloud-contract+yaml',
     'b1b2b3b4b5b6b7b8b9b0b1b2b3b4b5b6b7b8b9b0b1b2b3b4b5b6b7b8b9b0b1b2',
     'MESSAGING');

-- inventory-service publishes to stock-events topic (v1.1.0)
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash, interaction_type)
VALUES
    ((SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0', 'shouldPublishStockReserved.yml',
     'label: stock_reserved
input:
  triggeredBy: trigger()
outputMessage:
  sentTo: stock-events
  body:
    productId: 100
    quantity: 2
    orderId: 1
    warehouse: MAIN
  headers:
    contentType: application/json',
     'application/x-spring-cloud-contract+yaml',
     'c1c2c3c4c5c6c7c8c9c0c1c2c3c4c5c6c7c8c9c0c1c2c3c4c5c6c7c8c9c0c1c2',
     'MESSAGING');

-- notification-service publishes to notification-events topic (v1.0.0)
INSERT INTO contracts (application_id, version, contract_name, content, content_type, content_hash, interaction_type)
VALUES
    ((SELECT id FROM applications WHERE name = 'notification-service'), '1.0.0', 'shouldPublishEmailDelivered.yml',
     'label: email_delivered
input:
  triggeredBy: trigger()
outputMessage:
  sentTo: notification-events
  body:
    notificationId: 101
    channel: EMAIL
    status: DELIVERED
    recipient: customer@example.com
  headers:
    contentType: application/json',
     'application/x-spring-cloud-contract+yaml',
     'd1d2d3d4d5d6d7d8d9d0d1d2d3d4d5d6d7d8d9d0d1d2d3d4d5d6d7d8d9d0d1d2',
     'MESSAGING');

-- ============================================================
-- Contract Topics (messaging edges for dependency graph)
-- ============================================================

-- order-service publishes to order-events
INSERT INTO contract_topics (contract_id, application_id, version, topic_name, direction)
VALUES
    ((SELECT id FROM contracts WHERE contract_name = 'shouldPublishOrderCreated.yml' AND version = '1.2.0'),
     (SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'order-events', 'PUBLISH');

INSERT INTO contract_topics (contract_id, application_id, version, topic_name, direction)
VALUES
    ((SELECT id FROM contracts WHERE contract_name = 'shouldPublishOrderCancelled.yml' AND version = '1.2.0'),
     (SELECT id FROM applications WHERE name = 'order-service'), '1.2.0', 'order-events', 'PUBLISH');

-- payment-service publishes to payment-events
INSERT INTO contract_topics (contract_id, application_id, version, topic_name, direction)
VALUES
    ((SELECT id FROM contracts WHERE contract_name = 'shouldPublishPaymentCompleted.yml' AND version = '2.1.0'),
     (SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0', 'payment-events', 'PUBLISH');

INSERT INTO contract_topics (contract_id, application_id, version, topic_name, direction)
VALUES
    ((SELECT id FROM contracts WHERE contract_name = 'shouldPublishPaymentFailed.yml' AND version = '2.1.0'),
     (SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0', 'payment-events', 'PUBLISH');

-- inventory-service publishes to stock-events
INSERT INTO contract_topics (contract_id, application_id, version, topic_name, direction)
VALUES
    ((SELECT id FROM contracts WHERE contract_name = 'shouldPublishStockReserved.yml' AND version = '1.1.0'),
     (SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0', 'stock-events', 'PUBLISH');

-- notification-service publishes to notification-events
INSERT INTO contract_topics (contract_id, application_id, version, topic_name, direction)
VALUES
    ((SELECT id FROM contracts WHERE contract_name = 'shouldPublishEmailDelivered.yml' AND version = '1.0.0'),
     (SELECT id FROM applications WHERE name = 'notification-service'), '1.0.0', 'notification-events', 'PUBLISH');

-- ============================================================
-- Verifications
-- ============================================================

INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0',
     (SELECT id FROM applications WHERE name = 'payment-service'), '2.1.0',
     'SUCCESS', 'All 3 contract tests passed');

INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0',
     (SELECT id FROM applications WHERE name = 'notification-service'), '1.0.0',
     'SUCCESS', 'All 1 contract tests passed');

INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.1.0',
     (SELECT id FROM applications WHERE name = 'payment-service'), '2.0.0',
     'SUCCESS', 'All 2 contract tests passed');

INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'api-gateway'), '1.0.0',
     (SELECT id FROM applications WHERE name = 'order-service'), '1.2.0',
     'SUCCESS', 'All 1 contract tests passed');

INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'api-gateway'), '1.0.0',
     (SELECT id FROM applications WHERE name = 'user-service'), '3.1.0',
     'SUCCESS', 'All 1 contract tests passed');

INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.1.0',
     (SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0',
     'FAILED', 'Contract shouldReserveStock.yml failed: expected status 200 but got 400 -- missing required field "warehouse"');

INSERT INTO verifications (provider_id, provider_version, consumer_id, consumer_version, status, details)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'), '1.2.0',
     (SELECT id FROM applications WHERE name = 'inventory-service'), '1.1.0',
     'SUCCESS', 'All 2 contract tests passed');

-- ============================================================
-- Deployments
-- ============================================================

INSERT INTO deployments (application_id, environment, version)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'),   'production', '1.2.0'),
    ((SELECT id FROM applications WHERE name = 'payment-service'), 'production', '2.1.0'),
    ((SELECT id FROM applications WHERE name = 'user-service'),    'production', '3.1.0'),
    ((SELECT id FROM applications WHERE name = 'api-gateway'),     'production', '1.0.0');

INSERT INTO deployments (application_id, environment, version)
VALUES
    ((SELECT id FROM applications WHERE name = 'order-service'),        'staging', '1.2.0'),
    ((SELECT id FROM applications WHERE name = 'payment-service'),      'staging', '2.1.0'),
    ((SELECT id FROM applications WHERE name = 'notification-service'), 'staging', '1.0.0'),
    ((SELECT id FROM applications WHERE name = 'inventory-service'),    'staging', '1.1.0'),
    ((SELECT id FROM applications WHERE name = 'user-service'),         'staging', '3.1.0'),
    ((SELECT id FROM applications WHERE name = 'api-gateway'),          'staging', '1.0.0');

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
-- Git Import Sources
-- ============================================================
INSERT INTO git_import_sources (application_name, repository_url, branch, contracts_directory, auth_type, sync_enabled)
VALUES
    ('order-service', 'https://github.com/example/order-service', 'main', 'src/test/resources/contracts', 'NONE', TRUE),
    ('payment-service', 'https://github.com/example/payment-service', 'main', 'contracts/', 'NONE', TRUE),
    ('inventory-service', 'https://github.com/example/inventory-service', 'develop', 'src/contractTest/resources', 'NONE', FALSE);

-- ============================================================
-- Maven Import Sources
-- ============================================================
INSERT INTO maven_import_sources (repository_url, group_id, artifact_id, sync_enabled)
VALUES
    ('https://repo.maven.apache.org/maven2', 'com.example', 'order-service-stubs', TRUE),
    ('https://repo.maven.apache.org/maven2', 'com.example', 'payment-service-stubs', TRUE),
    ('https://nexus.example.com/repository/releases', 'com.example', 'inventory-service-stubs', FALSE);

-- ============================================================
-- Webhooks
-- ============================================================
INSERT INTO webhooks (application_id, event_type, url, headers, enabled)
VALUES
    ((SELECT id FROM applications WHERE name = 'notification-service'),
     'CONTRACT_PUBLISHED',
     'https://hooks.example.com/stubborn/notifications',
     '{"X-Webhook-Secret": "demo-secret-token"}',
     TRUE);
