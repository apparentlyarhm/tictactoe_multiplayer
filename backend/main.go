package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

// our go plugin thingy - which we will inject into the engine i think?
func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("---> Tic-Tac-Toe module loaded successfully! <---")

	return nil
}
