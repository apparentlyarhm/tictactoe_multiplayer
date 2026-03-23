package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

type MatchState struct {
	presences    []runtime.Presence // The players in the match
	board        [9]int             // 0 = Empty, 1 = X, 2 = O
	turnCount    int                // How many moves have been made
	mark         int                // Whose turn is it? (1 or 2)
	mode         string             // "classic" or "timed"
	deadline     int64              // The server tick when the current player runs out of time
	ticksPerTurn int64              // E.g. 30 seconds * 10 ticks = 300 ticks
}

type Match struct{}

// TODO: implement all logic properly
func (m *Match) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {

	mode := "classic"
	if params["mode"] != nil {
		mode = params["mode"].(string)
	}

	tickRate := 10

	state := &MatchState{
		presences:    make([]runtime.Presence, 0, 2),
		board:        [9]int{},
		turnCount:    0,
		mark:         1,
		mode:         mode,
		ticksPerTurn: 30 * int64(tickRate),
		deadline:     0,
	}

	label := "tictactoe"

	return state, tickRate, label
}

func (m *Match) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	s := state.(*MatchState)

	if len(s.presences) >= 2 {
		return s, false, "Match is full"
	}
	return s, true, ""
}

// MatchJoin is called after they successfully join.
func (m *Match) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*MatchState)
	s.presences = append(s.presences, presences...)

	// If 2 players are here, the game can start!
	if len(s.presences) == 2 {
		logger.Info("Two players joined! Game starting.")
	}

	return s
}

// MatchLeave is called when a player disconnects or quits.
func (m *Match) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*MatchState)
	// mandatory rage quit processing
	return s
}

// MatchLoop is the heartbeat of the game. It runs 10 times a second.
func (m *Match) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	s := state.(*MatchState)

	for _, message := range messages {
		logger.Info("Received message from %s: %s", message.GetUserId(), string(message.GetData()))
	}

	return s
}

// MatchTerminate is called when the server shuts down the match.
func (m *Match) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *Match) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, data
}
