INSERT INTO chat_context_boundaries (
    chat_id,
    kind,
    after_message_id,
    visible,
    created_at,
    metadata
) VALUES (
    '72c0438a-18eb-4688-ab80-e4c6a126ef96',
    'clear',
    (SELECT MAX(id) FROM chat_messages WHERE chat_id = '72c0438a-18eb-4688-ab80-e4c6a126ef96'),
    true,
    '2024-01-01 00:00:00+00',
    '{"fixture": true}'::jsonb
);
