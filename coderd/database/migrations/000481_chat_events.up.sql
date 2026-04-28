CREATE TABLE chat_events (
    id BIGSERIAL PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('message_created', 'context_boundary')),
    message_id BIGINT REFERENCES chat_messages(id) ON DELETE CASCADE,
    boundary_kind TEXT,
    boundary_source TEXT,
    boundary_scope TEXT NOT NULL DEFAULT 'chat' CHECK (boundary_scope <> ''),
    boundary_after_event_id BIGINT REFERENCES chat_events(id) ON DELETE SET NULL,
    boundary_summary_message_id BIGINT REFERENCES chat_messages(id) ON DELETE SET NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CHECK (
        (
            kind = 'message_created'
            AND message_id IS NOT NULL
            AND boundary_kind IS NULL
            AND boundary_source IS NULL
            AND boundary_after_event_id IS NULL
            AND boundary_summary_message_id IS NULL
        )
        OR (
            kind = 'context_boundary'
            AND message_id IS NULL
            AND boundary_kind IS NOT NULL
            AND boundary_kind <> ''
            AND boundary_source IS NOT NULL
            AND boundary_source <> ''
        )
    )
);

CREATE INDEX idx_chat_events_chat_id_id ON chat_events(chat_id, id);
CREATE UNIQUE INDEX idx_chat_events_message_id
    ON chat_events(message_id)
    WHERE kind = 'message_created';
CREATE INDEX idx_chat_events_latest_boundary
    ON chat_events(chat_id, id DESC)
    WHERE kind = 'context_boundary'
        AND boundary_scope = 'chat';
CREATE INDEX idx_chat_events_visible_timeline
    ON chat_events(chat_id, id)
    WHERE visible = TRUE;

INSERT INTO chat_events (
    id,
    chat_id,
    kind,
    message_id,
    visible,
    created_by,
    created_at
)
SELECT
    chat_messages.id * 2,
    chat_messages.chat_id,
    'message_created',
    chat_messages.id,
    chat_messages.visibility IN ('user', 'both'),
    chat_messages.created_by,
    chat_messages.created_at
FROM
    chat_messages;

INSERT INTO chat_events (
    id,
    chat_id,
    kind,
    boundary_kind,
    boundary_source,
    boundary_scope,
    boundary_after_event_id,
    boundary_summary_message_id,
    visible,
    created_by,
    created_at
)
SELECT
    chat_messages.id * 2 + 1,
    chat_messages.chat_id,
    'context_boundary',
    'compact',
    'automatic',
    'chat',
    chat_messages.id * 2,
    chat_messages.id,
    false,
    chat_messages.created_by,
    chat_messages.created_at
FROM
    chat_messages
WHERE
    chat_messages.compressed = true
    AND chat_messages.deleted = false
    AND chat_messages.visibility = 'model';

SELECT setval(
    pg_get_serial_sequence('chat_events', 'id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM chat_events), 1), 1),
    (SELECT MAX(id) IS NOT NULL FROM chat_events)
);
