CREATE TABLE webhooks (
    id UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    headers CLOB,
    body_template TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    row_version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE webhook_executions (
    id UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    request_url VARCHAR(2048) NOT NULL,
    request_body TEXT,
    response_status INT,
    response_body TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhooks_application ON webhooks(application_id);
CREATE INDEX idx_webhooks_event_type ON webhooks(event_type);
CREATE INDEX idx_webhook_executions_webhook ON webhook_executions(webhook_id, executed_at DESC);
