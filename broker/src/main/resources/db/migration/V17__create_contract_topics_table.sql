CREATE TABLE contract_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    version VARCHAR(64) NOT NULL,
    topic_name VARCHAR(256) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contract_topics_topic ON contract_topics(topic_name);
CREATE INDEX idx_contract_topics_app ON contract_topics(application_id);
CREATE INDEX idx_contract_topics_contract ON contract_topics(contract_id);
