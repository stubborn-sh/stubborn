CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    headers JSONB,
    body_template TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE webhook_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    request_url VARCHAR(2048) NOT NULL,
    request_body TEXT,
    response_status INT,
    response_body TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_application ON webhooks(application_id);
CREATE INDEX idx_webhooks_event_type ON webhooks(event_type);
CREATE INDEX idx_webhook_executions_webhook ON webhook_executions(webhook_id, executed_at DESC);
