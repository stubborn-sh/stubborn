#!/usr/bin/env bash
# Populates the broker with realistic demo data for showcasing the dashboard.
# Usage: ./seed-demo.sh [broker-url]
#   Default broker URL: http://localhost:8642
set -euo pipefail

BROKER="${1:-http://localhost:8642}"
AUTH="admin:admin"

post() { curl -s -u "$AUTH" -X POST "$BROKER$1" -H 'Content-Type: application/json' -d "$2" -o /dev/null -w "%{http_code}"; }
put()  { curl -s -u "$AUTH" -X PUT  "$BROKER$1" -H 'Content-Type: application/json' -d "$2" -o /dev/null -w "%{http_code}"; }
get()  { curl -s -u "$AUTH" "$BROKER$1"; }

echo "==> Seeding broker at $BROKER"

# ── Environments ──────────────────────────────────────────────────────────
echo "  Environments..."
post "/api/v1/environments" '{"name":"dev","description":"Development","displayOrder":0,"production":false}' > /dev/null
post "/api/v1/environments" '{"name":"staging","description":"Pre-production","displayOrder":1,"production":false}' > /dev/null
post "/api/v1/environments" '{"name":"production","description":"Live traffic","displayOrder":2,"production":true}' > /dev/null

# ── Applications ──────────────────────────────────────────────────────────
echo "  Applications..."
apps=(
  '{"name":"order-service","description":"Handles order lifecycle","owner":"team-orders"}'
  '{"name":"payment-service","description":"Payment processing","owner":"team-payments"}'
  '{"name":"inventory-service","description":"Stock management","owner":"team-inventory"}'
  '{"name":"notification-service","description":"Email and SMS notifications","owner":"team-comms"}'
  '{"name":"user-service","description":"User accounts and profiles","owner":"team-identity"}'
  '{"name":"shipping-service","description":"Shipping and logistics","owner":"team-logistics"}'
  '{"name":"checkout-ui","description":"Checkout frontend BFF","owner":"team-frontend"}'
  '{"name":"admin-dashboard","description":"Internal admin portal","owner":"team-platform"}'
)
for app in "${apps[@]}"; do
  post "/api/v1/applications" "$app" > /dev/null
done

# ── Contracts ─────────────────────────────────────────────────────────────
echo "  Contracts..."
publish_contract() {
  local app="$1" version="$2" name="$3" method="$4" url="$5" status="$6" branch="${7:-main}"
  local content="request:\n  method: $method\n  url: $url\nresponse:\n  status: $status"
  post "/api/v1/applications/$app/versions/$version/contracts" \
    "{\"contractName\":\"$name\",\"content\":\"$content\",\"contentType\":\"application/x-spring-cloud-contract+yaml\",\"branch\":\"$branch\"}" > /dev/null
}

# order-service contracts (multiple versions)
for v in 1.0.0 1.1.0 1.2.0 2.0.0; do
  publish_contract order-service "$v" get-order GET "/orders/1" 200
  publish_contract order-service "$v" create-order POST "/orders" 201
  publish_contract order-service "$v" list-orders GET "/orders" 200
done
publish_contract order-service 2.1.0-SNAPSHOT get-order GET "/orders/1" 200 feature/async-orders

# payment-service
for v in 1.0.0 1.1.0 2.0.0; do
  publish_contract payment-service "$v" process-payment POST "/payments" 201
  publish_contract payment-service "$v" get-payment GET "/payments/1" 200
done

# inventory-service
for v in 1.0.0 1.1.0; do
  publish_contract inventory-service "$v" check-stock GET "/stock/SKU-1" 200
  publish_contract inventory-service "$v" reserve-stock POST "/stock/reserve" 200
done

# notification-service
publish_contract notification-service 1.0.0 send-email POST "/notifications/email" 202
publish_contract notification-service 1.0.0 send-sms POST "/notifications/sms" 202

# user-service
for v in 1.0.0 2.0.0; do
  publish_contract user-service "$v" get-user GET "/users/1" 200
  publish_contract user-service "$v" create-user POST "/users" 201
done

# shipping-service
publish_contract shipping-service 1.0.0 create-shipment POST "/shipments" 201
publish_contract shipping-service 1.0.0 track-shipment GET "/shipments/1" 200

# checkout-ui (consumes order + payment + inventory)
publish_contract checkout-ui 3.0.0 get-cart GET "/cart" 200
publish_contract checkout-ui 3.1.0 get-cart GET "/cart" 200

# ── Verifications ─────────────────────────────────────────────────────────
echo "  Verifications..."
verify() {
  local provider="$1" pv="$2" consumer="$3" cv="$4" status="$5" branch="${6:-main}"
  post "/api/v1/verifications" \
    "{\"providerName\":\"$provider\",\"providerVersion\":\"$pv\",\"consumerName\":\"$consumer\",\"consumerVersion\":\"$cv\",\"status\":\"$status\",\"branch\":\"$branch\"}" > /dev/null
}

# checkout-ui verifies against order-service
verify order-service 1.2.0 checkout-ui 3.0.0 SUCCESS
verify order-service 2.0.0 checkout-ui 3.1.0 SUCCESS

# checkout-ui verifies against payment-service
verify payment-service 2.0.0 checkout-ui 3.0.0 SUCCESS
verify payment-service 2.0.0 checkout-ui 3.1.0 SUCCESS

# checkout-ui verifies against inventory-service
verify inventory-service 1.1.0 checkout-ui 3.0.0 SUCCESS
verify inventory-service 1.1.0 checkout-ui 3.1.0 SUCCESS

# payment-service verifies against order-service (reads order data)
verify order-service 1.2.0 payment-service 1.1.0 SUCCESS
verify order-service 2.0.0 payment-service 2.0.0 SUCCESS

# notification-service verifies against order-service
verify order-service 1.2.0 notification-service 1.0.0 SUCCESS
verify order-service 2.0.0 notification-service 1.0.0 FAILED  # incompatible with v2

# shipping-service verifies against order-service
verify order-service 2.0.0 shipping-service 1.0.0 SUCCESS

# admin-dashboard verifies against user-service
verify user-service 1.0.0 admin-dashboard 1.0.0 SUCCESS
verify user-service 2.0.0 admin-dashboard 1.0.0 FAILED  # breaking change

# notification-service verifies against user-service
verify user-service 2.0.0 notification-service 1.0.0 SUCCESS

# Feature branch verification (pending)
verify order-service 2.1.0-SNAPSHOT checkout-ui 3.1.0 FAILED feature/async-orders

# ── Deployments ───────────────────────────────────────────────────────────
echo "  Deployments..."
deploy() {
  local env="$1" app="$2" version="$3"
  post "/api/v1/environments/$env/deployments" \
    "{\"applicationName\":\"$app\",\"version\":\"$version\"}" > /dev/null
}

# dev — latest everything
deploy dev order-service 2.0.0
deploy dev payment-service 2.0.0
deploy dev inventory-service 1.1.0
deploy dev notification-service 1.0.0
deploy dev user-service 2.0.0
deploy dev shipping-service 1.0.0
deploy dev checkout-ui 3.1.0
deploy dev admin-dashboard 1.0.0

# staging — slightly behind dev
deploy staging order-service 2.0.0
deploy staging payment-service 2.0.0
deploy staging inventory-service 1.1.0
deploy staging notification-service 1.0.0
deploy staging user-service 1.0.0
deploy staging checkout-ui 3.0.0

# production — stable versions
deploy production order-service 1.2.0
deploy production payment-service 1.1.0
deploy production inventory-service 1.0.0
deploy production notification-service 1.0.0
deploy production user-service 1.0.0
deploy production checkout-ui 3.0.0

# ── Tags ──────────────────────────────────────────────────────────────────
echo "  Tags..."
tag() {
  local app="$1" version="$2" tag="$3"
  put "/api/v1/applications/$app/versions/$version/tags/$tag" '{}' > /dev/null
}

tag order-service 1.2.0 RELEASE
tag order-service 2.0.0 RELEASE
tag order-service 2.1.0-SNAPSHOT SNAPSHOT
tag payment-service 2.0.0 RELEASE
tag inventory-service 1.1.0 RELEASE
tag user-service 2.0.0 RELEASE
tag checkout-ui 3.1.0 RELEASE
tag shipping-service 1.0.0 RELEASE

# ── Webhooks ──────────────────────────────────────────────────────────────
echo "  Webhooks..."
post "/api/v1/webhooks" '{"eventType":"CONTRACT_PUBLISHED","url":"https://ci.example.com/hooks/contract-published"}' > /dev/null
post "/api/v1/webhooks" '{"eventType":"VERIFICATION_FAILED","url":"https://slack.example.com/hooks/verification-failed"}' > /dev/null
post "/api/v1/webhooks" '{"eventType":"DEPLOYMENT_RECORDED","url":"https://ci.example.com/hooks/deployment","applicationName":"order-service"}' > /dev/null

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "==> Demo data seeded successfully!"
echo ""
echo "  8 applications, 3 environments, ~30 contracts"
echo "  15 verifications (13 SUCCESS, 2 FAILED)"
echo "  20 deployments across dev/staging/production"
echo "  8 version tags, 3 webhooks"
echo ""
echo "  Interesting scenarios to explore:"
echo "    - can-i-deploy order-service 2.0.0 to production  (UNSAFE — notification-service failed)"
echo "    - can-i-deploy checkout-ui 3.1.0 to staging       (SAFE)"
echo "    - can-i-deploy user-service 2.0.0 to staging      (UNSAFE — admin-dashboard failed)"
echo "    - dependency graph shows checkout-ui depends on 3 services"
echo "    - matrix shows order-service has 4 consumers"
echo "    - feature branch order-service 2.1.0-SNAPSHOT has pending failure"
