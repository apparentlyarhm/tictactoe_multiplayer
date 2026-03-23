"use client"

import { useEffect, useState, useRef } from "react";
import { Client, Session, Socket, MatchmakerMatched, MatchData } from "@heroiclabs/nakama-js";
import { v4 as uuidv4 } from "uuid";

// OP CODE FOR STATE UPDATES
const OP_UPDATE_STATE = 1;

// OP CODE FOR MAKING A MOVE
const OP_MAKE_MOVE = 2;

// OP CODE FOR GAME OVER
const OP_GAME_OVER = 3;

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [matchId, setMatchId] = useState<string | null>(null);

  const [board, setBoard] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]); // representing the board in this manner is simple
  const [currentTurn, setCurrentTurn] = useState<number>(1);
  const [winner, setWinner] = useState<number | null>(null);

  const clientRef = useRef<Client | null>(null);


  useEffect(() => {
    // nakama client init
    const client = new Client(
      process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || "defaultkey",
      process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1",
      process.env.NEXT_PUBLIC_NAKAMA_PORT || "7350"
    );
    clientRef.current = client;

    const authenticate = async () => {
      try {
        // silent auth start

        // create creds
        let deviceId = localStorage.getItem("tictactoe_device_id");
        if (!deviceId) {
          deviceId = uuidv4();
          localStorage.setItem("tictactoe_device_id", deviceId);
        }


        const newSession = await client.authenticateDevice(deviceId, true); // true = create account if missing
        setSession(newSession);

        // create socket connection
        const newSocket = client.createSocket(false, false); // useSSL = false, trace = false
        await newSocket.connect(newSession, true);
        setSocket(newSocket);

        setStatus(`Connected as: ${newSession.username}`);

        // listen for success event
        newSocket.onmatchmakermatched = async (matched: MatchmakerMatched) => {
          setStatus("Match found! Joining server...");

          // When matched, the server gives us a token. We use it to officially join the room.
          const match = await newSocket.joinMatch(matched.match_id, matched.token);
          setMatchId(match.match_id);
          setStatus(`In Match: ${match.match_id}`);
        };

        newSocket.onmatchdata = (matchData: MatchData) => {
          const json = new TextDecoder().decode(matchData.data);
          const payload = JSON.parse(json);

          if (matchData.op_code === OP_UPDATE_STATE) {
            // Server sent the new board state
            setBoard(payload.board);
            setCurrentTurn(payload.mark);
          }
          else if (matchData.op_code === OP_GAME_OVER) {
            // Server announced a winner (0 means draw)
            setWinner(payload.winner);
            setStatus(payload.winner === 0 ? "It's a Draw!" : `Player ${payload.winner} Wins!`);
          }
        };

      } catch (error) {
        console.error("Auth error:", error);
        setStatus("Failed to connect to server.");
      }
    };

    authenticate();

    // Cleanup on unmount
    return () => {
      // fire dc event - off
      if (socket) socket.disconnect(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- UI Actions ---

  const findMatch = async () => {
    if (!socket) return;
    setStatus("Searching for a player...");

    const query = "*";
    const minPlayers = 2;
    const maxPlayers = 2;

    // hard coded for now
    const stringProperties = { mode: "classic" };

    try {
      await socket.addMatchmaker(query, minPlayers, maxPlayers, stringProperties);
    } catch (error) {
      console.error("Matchmaker error:", error);
      setStatus("Error joining matchmaking.");
    }
  };

  const renderSquare = (val: number) => {
    if (val === 1) return <span className="text-blue-500">X</span>;
    if (val === 2) return <span className="text-red-500">O</span>;
    return "";
  };

  const handleSquareClick = (index: number) => {
    // basic client side checks - server also does this
    if (!socket || !matchId || winner !== null || board[index] !== 0) return;

    const payload = JSON.stringify({ position: index });
    socket.sendMatchState(matchId, OP_MAKE_MOVE, payload);
  };
  return (
    // an ai generated sample ui because i wanted to test the backend e2e
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
        <h1 className="text-4xl font-bold mb-4">Tic-Tac-Toe</h1>

        <div className="mb-8 p-4 bg-gray-800 rounded-lg text-center">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-lg text-green-400 font-mono">{status}</p>
        </div>

        {!matchId ? (
          <button
            onClick={findMatch}
            disabled={!socket || status.includes("Searching")}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-xl disabled:opacity-50 transition-all"
          >
            {status.includes("Searching") ? "Looking for opponent..." : "Find Match"}
          </button>
        ) : (
          <div className="flex flex-col items-center">

            {winner === null && (
              <div className="mb-4 text-xl">
                Turn: Player {currentTurn} {currentTurn === 1 ? "(X)" : "(O)"}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 bg-gray-700 p-2 rounded-lg">
              {board.map((val, index) => (
                <button
                  key={index}
                  onClick={() => handleSquareClick(index)}
                  className="w-24 h-24 bg-gray-800 hover:bg-gray-600 flex items-center justify-center text-5xl font-bold rounded"
                >
                  {renderSquare(val)}
                </button>
              ))}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
