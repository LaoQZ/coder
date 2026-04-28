CREATE TABLE chat_context_boundaries (
    id BIGSERIAL PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('clear', 'compact')),
    after_message_id BIGINT REFERENCES chat_messages(id) ON DELETE SET NULL,
    summary_message_id BIGINT REFERENCES chat_messages(id) ON DELETE SET NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CHECK (
        (kind = 'clear' AND summary_message_id IS NULL)
        OR (kind = 'compact' AND summary_message_id IS NOT NULL)
    )
);

CREATE INDEX idx_chat_context_boundaries_chat_id_id
    ON chat_context_boundaries(chat_id, id);

CREATE INDEX idx_chat_context_boundaries_latest
    ON chat_context_boundaries(chat_id, id DESC);

CREATE INDEX idx_chat_context_boundaries_visible
    ON chat_context_boundaries(chat_id, id)
    WHERE visible = TRUE;

INSERT INTO chat_context_boundaries (
    chat_id,
    kind,
    after_message_id,
    summary_message_id,
    visible,
    created_by,
    created_at,
    metadata
)
SELECT
    chat_messages.chat_id,
    'compact',
    chat_messages.id,
    chat_messages.id,
    false,
    chat_messages.created_by,
    chat_messages.created_at,
    jsonb_build_object('backfilled', true)
FROM
    chat_messages
WHERE
    chat_messages.compressed = true
    AND chat_messages.deleted = false
    AND chat_messages.visibility = 'model';
