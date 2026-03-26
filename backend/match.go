package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	OpCodeUpdateState = 1
	OpCodeMakeMove    = 2
	OpCodeGameOver    = 3
	TickRate          = 10
	TicksPerTurn      = 100
)

type MatchState struct {
	presences    []runtime.Presence // The players in the match
	board        [9]int             // 0 = Empty, 1 = X, 2 = O
	turnCount    int                // How many moves have been made
	mark         int                // Whose turn is it? (1 or 2)
	mode         string             // "classic" or "timed"
	deadline     int64              // The server tick when the current player runs out of time
	ticksPerTurn int64              // E.g. 30 seconds * 10 ticks = 300 ticks
	deadlineMs   int64              // ms value of the deadline to keep clocks in sync
}

type MovePayload struct {
	Position int `json:"position"`
}

type StatePayload struct {
	Board      [9]int `json:"board"`
	Mark       int    `json:"mark"`
	Mode       string `json:"mode"`
	Deadline   int64  `json:"deadline"`
	Player1    string `json:"player1"`
	Player2    string `json:"player2"`
	DeadlineMs int64  `json:"deadline_ms"`
}

type GameOverPayload struct {
	Winner int    `json:"winner"`
	Reason string `json:"reason"` // "win", "draw", "timeout", "disconnect"
}

type Match struct{}

func (m *Match) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {

	mode := "classic"
	if params["mode"] != nil {
		mode = params["mode"].(string)
	}

	state := &MatchState{
		presences:    make([]runtime.Presence, 0, 2),
		board:        [9]int{},
		turnCount:    0,
		mark:         1,
		mode:         mode,
		ticksPerTurn: TicksPerTurn * int64(TickRate),
		deadline:     0,
		deadlineMs:   0,
	}

	label := "tictactoe"
	return state, TickRate, label
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
		s.deadline = tick + s.ticksPerTurn

		broadcastState(dispatcher, s)
	}

	return s
}

// MatchLeave is called when a player disconnects or quits.
func (m *Match) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*MatchState)

	if len(s.presences) < 2 {
		return nil
	}

	// mandatory rage quit processing
	if len(s.presences) == 2 {
		leaverId := presences[0].GetUserId()
		winnerIndex := 1 // Assume Player 2 wins

		if s.presences[0].GetUserId() == leaverId {
			winnerIndex = 2 // Player 1 left, so Player 2 (mark 2) wins
		}

		broadcastGameOver(dispatcher, winnerIndex, "disconnect")
		recordWin(logger, nk, s.presences[winnerIndex-1])

		return nil
	}
	return s
}

// MatchLoop is the heartbeat of the game. It runs 10 times a second.
func (m *Match) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	s := state.(*MatchState)

	if len(s.presences) < 2 {
		return s
	}

	// TODO: watch
	if s.deadline == 0 {
		s.deadline = tick + s.ticksPerTurn

		duration := time.Duration(s.ticksPerTurn/TickRate) * time.Second
		s.deadlineMs = time.Now().Add(duration).UnixMilli()

		// Broadcast the initial state so the frontend knows the game started
		broadcastState(dispatcher, s)
	}

	if s.mode == "timed" && tick >= s.deadline {
		// Current player ran out of time. The OTHER player wins.
		winner := 2
		if s.mark == 2 {
			winner = 1
		}

		broadcastGameOver(dispatcher, winner, "timeout")
		recordWin(logger, nk, s.presences[winner-1])
		persistMatch(ctx, logger, nk, s, winner)

		return nil // Kill the match
	}

	for _, message := range messages {
		// Opcode dictates what the server has to do
		if message.GetOpCode() == OpCodeMakeMove {

			logger.Info("RECEIVED MOVE from UserID: %s", message.GetUserId())

			// TODO: improve logic
			senderMark := 0
			if message.GetUserId() == s.presences[0].GetUserId() {
				senderMark = 1
			} else if message.GetUserId() == s.presences[1].GetUserId() {
				senderMark = 2
			}

			if senderMark == 0 {
				continue // Ignore spectators or ghosts
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

			winner := checkWin(s.board)

			if winner > 0 {
				broadcastState(dispatcher, s)                // show state to everyone
				broadcastGameOver(dispatcher, winner, "win") // send a win condition

				recordWin(logger, nk, s.presences[winner-1]) // Add to leaderboards
				persistMatch(ctx, logger, nk, s, winner)     // Persist the entire match

				return nil

			} else if isDraw(s.board) {
				broadcastState(dispatcher, s) // show state to everyone
				broadcastGameOver(dispatcher, 0, "draw")

				// Persist the entire match
				persistMatch(ctx, logger, nk, s, -1)

				return nil
			}

			if s.mark == 1 {
				s.mark = 2
			} else {
				s.mark = 1
			}
			s.deadline = tick + s.ticksPerTurn

			duration := time.Duration(s.ticksPerTurn/TickRate) * time.Second
			s.deadlineMs = time.Now().Add(duration).UnixMilli()

			broadcastState(dispatcher, s)
		}
	}

	return s
}

// MatchTerminate is called when the server shuts down the match.
func (m *Match) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
	// will add cleanups if needed
}

func (m *Match) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, data
}

// helpers
func broadcastState(dispatcher runtime.MatchDispatcher, s *MatchState) {
	p1, p2 := "", ""
	if len(s.presences) > 0 {
		p1 = s.presences[0].GetUserId()
	}
	if len(s.presences) > 1 {
		p2 = s.presences[1].GetUserId()
	}

	payload := StatePayload{
		Board:      s.board,
		Mark:       s.mark,
		Deadline:   s.deadline,
		DeadlineMs: s.deadlineMs,
		Mode:       s.mode,
		Player1:    p1,
		Player2:    p2,
	}
	bytes, _ := json.Marshal(payload)
	dispatcher.BroadcastMessage(OpCodeUpdateState, bytes, nil, nil, true)
}

func broadcastGameOver(dispatcher runtime.MatchDispatcher, winner int, reason string) {
	payload := GameOverPayload{
		Winner: winner,
		Reason: reason,
	}
	bytes, _ := json.Marshal(payload)
	dispatcher.BroadcastMessage(OpCodeGameOver, bytes, nil, nil, true)
}

func persistMatch(ctx context.Context, logger runtime.Logger, nk runtime.NakamaModule, state *MatchState, winner int) {
	m := ctx.Value(runtime.RUNTIME_CTX_MATCH_ID).(string)

	go func() {
		bgCtx := context.Background()

		record := map[string]interface{}{
			"board":   state.board,
			"winner":  winner,
			"player1": state.presences[0].GetUserId(),
			"player2": state.presences[1].GetUserId(),
		}

		bytes, _ := json.Marshal(record)

		// simplest: use Nakama storage
		_, err := nk.StorageWrite(bgCtx, []*runtime.StorageWrite{
			{
				Collection:      "matches",
				Key:             m,
				Value:           string(bytes),
				PermissionRead:  2,
				PermissionWrite: 0,
			},
		})

		if err != nil {
			logger.Error("failed to persist match: %v", err)
		}
	}()
}

func recordWin(logger runtime.Logger, nk runtime.NakamaModule, winner runtime.Presence) {
	// Add 1 point to the winner's score
	go func() {
		bgCtx := context.Background()

		_, err := nk.LeaderboardRecordWrite(
			bgCtx,
			"tictactoe_global",
			winner.GetUserId(),
			winner.GetUsername(),
			1,
			0,
			nil,
			nil,
		)

		if err != nil {
			// don't break game flow
			logger.Error("failed to record win: %v", err)
		}
	}()
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
