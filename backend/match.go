package main

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	OpCodeUpdateState = 1
	OpCodeMakeMove    = 2
	OpCodeGameOver    = 3
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

type MovePayload struct {
	Position int `json:"position"`
}

type StatePayload struct {
	Board [9]int `json:"board"`
	Mark  int    `json:"mark"`
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
		// Did a client send a "Make Move" OpCode?
		if message.GetOpCode() == OpCodeMakeMove {

			// Figure out if the sender is Player 1 (X) or Player 2 (O)
			senderMark := 1
			if message.GetUserId() == s.presences[1].GetUserId() {
				senderMark = 2
			}

			// Is it actually their turn?
			if s.mark != senderMark {
				continue // Ignore hackers trying to play out of turn
			}

			// Decode the JSON payload they sent {"position": 4}
			var payload MovePayload
			if err := json.Unmarshal(message.GetData(), &payload); err != nil {
				continue
			}

			// Is the square valid and empty?
			if payload.Position < 0 || payload.Position > 8 || s.board[payload.Position] != 0 {
				continue // Ignore invalid moves
			}

			// --- THE MOVE IS VALID! ---

			// Apply the move to the server's board
			s.board[payload.Position] = senderMark

			// Check if this move won the game
			winner := checkWin(s.board)
			if winner > 0 || isDraw(s.board) {
				// Broadcast Game Over
				winMsg, _ := json.Marshal(map[string]int{"winner": winner})
				dispatcher.BroadcastMessage(OpCodeGameOver, winMsg, nil, nil, true)

				return s // Returning here keeps the state as-is, we will close the match later
			}

			if s.mark == 1 {
				s.mark = 2
			} else {
				s.mark = 1
			}

			broadcastState(dispatcher, s)
		}
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

// helpers
func broadcastState(dispatcher runtime.MatchDispatcher, s *MatchState) {
	payload := StatePayload{
		Board: s.board,
		Mark:  s.mark,
	}
	bytes, _ := json.Marshal(payload)
	// Send OpCode 1 to everyone
	dispatcher.BroadcastMessage(OpCodeUpdateState, bytes, nil, nil, true)
}

func checkWin(b [9]int) int {
	wins := [8][3]int{
		{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, // Rows
		{0, 3, 6}, {1, 4, 7}, {2, 5, 8}, // Cols
		{0, 4, 8}, {2, 4, 6}, // Diagonals
	}
	for _, w := range wins {
		if b[w[0]] != 0 && b[w[0]] == b[w[1]] && b[w[1]] == b[w[2]] {
			return b[w[0]]
		}
	}
	return 0
}

func isDraw(b [9]int) bool {
	for _, v := range b {
		if v == 0 {
			return false // Still empty spaces
		}
	}
	return true
}
