package chatd

import (
	"context"

	"cdr.dev/slog/v3"
	"github.com/coder/coder/v2/coderd/database"
)

// WaitUntilIdleForTest waits for background chat work tracked by the server to
// finish without shutting the server down. Tests use this to assert final
// database state only after asynchronous chat processing has completed.
// Close waits for the same tracked work, but also stops the server.
func WaitUntilIdleForTest(server *Server) {
	server.drainInflight()
}

// FinishActiveChatForTest exposes the unexported cleanup TX so tests
// can drive the post-run state machine deterministically. Returns the
// resulting chat, the promoted message (if any), and the cleanup
// error.
func FinishActiveChatForTest(
	ctx context.Context,
	server *Server,
	chat database.Chat,
	status database.ChatStatus,
	lastError string,
) (database.Chat, *database.ChatMessage, error) {
	logger := server.logger.With(slog.F("chat_id", chat.ID))
	result, err := server.finishActiveChat(ctx, logger, chat, status, lastError)
	if err != nil {
		return database.Chat{}, nil, err
	}
	return result.updatedChat, result.promotedMessage, nil
}

// RecoverStaleChatsForTest exposes the unexported stale-recovery loop
// so tests can assert the recovery state machine without waiting for
// the periodic ticker.
func RecoverStaleChatsForTest(ctx context.Context, server *Server) {
	server.recoverStaleChats(ctx)
}

// InsertSyntheticToolResultsTxForTest exposes the unexported helper
// so tests can verify the dedup path against pre-existing tool
// results.
func InsertSyntheticToolResultsTxForTest(
	ctx context.Context,
	store database.Store,
	chat database.Chat,
	reason string,
) error {
	return insertSyntheticToolResultsTx(ctx, store, chat, reason)
}
