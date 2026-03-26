CREATE TABLE users
(
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE conversations
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL
);

-- a row in this table simply means "user X is a member of conversation Y"
CREATE TABLE conversation_members
(
    conversation_id UUID NOT NULL REFERENCES conversations (id),
    user_id         UUID NOT NULL REFERENCES users (id),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages
(
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations (id),
    from_user_id    UUID NOT NULL REFERENCES users (id),
    body            TEXT NOT NULL,
    seq             BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON messages (conversation_id, seq);