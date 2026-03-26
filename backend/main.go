package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

// our go plugin thingy - which we will inject into the engine i think?
func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("=== TIC TAC TOE INIT ===")

	id := "tictactoe_global"
	authoritative := true // Only the server can write to it (prevents cheating)
	sortOrder := "desc"   // Highest score wins
	operator := "incr"    // Add points to the existing score
	resetSchedule := ""   // Never reset automatically (could be weekly like "0 0 * * 0")
	metadata := make(map[string]interface{})
	isRanked := false

	// last arg is for ranks - we will keep it disabled
	if err := nk.LeaderboardCreate(ctx, id, authoritative, sortOrder, operator, resetSchedule, metadata, isRanked); err != nil {
		logger.Error("Failed to create leaderboard: %v", err)
		return err
	}

	// Register the Authoritative Match
	if err := initializer.RegisterMatch("tictactoe", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &Match{}, nil
	}); err != nil {
		return err
	}

	// Register the Matchmaker Hook
	// When Nakama's matchmaker finds 2 players, it calls this function to start the actual game room
	if err := initializer.RegisterMatchmakerMatched(MatchmakerMatched); err != nil {
		return err
	}

	return nil
}

func MatchmakerMatched(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, entries []runtime.MatchmakerEntry) (string, error) {

	// We can read if they wanted "timed" or "classic" from the matchmaker entries
	mode := "classic"
	if entries[0].GetProperties()["mode"] != nil {
		mode = entries[0].GetProperties()["mode"].(string)
	}

	// Pass the mode to the MatchInit function
	params := map[string]interface{}{
		"mode": mode,
	}

	// Create the authoritative match and get the Match ID back
	matchId, err := nk.MatchCreate(ctx, "tictactoe", params)
	if err != nil {
		return "", err
	}

	return matchId, nil
}
