"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNakama } from "../context/NakamaGlobalContext";
import { MatchData, ChannelMessage } from "@heroiclabs/nakama-js";

const OP_UPDATE_STATE = 1;
const OP_MAKE_MOVE = 2;
const OP_GAME_OVER = 3;

export default function GameRoom() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { session, socket, status } = useNakama();

    const matchId = searchParams.get("matchId");

    // Game State
    const [board, setBoard] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const [currentTurn, setCurrentTurn] = useState<number>(1);
    const [myPlayerNumber, setMyPlayerNumber] = useState<number>(0); // 1 for X, 2 for O
    const [winner, setWinner] = useState<number | null>(null);
    const [gameOverReason, setGameOverReason] = useState<string>("");

    // Chat State
    const [chatRoomId, setChatRoomId] = useState<string | null>(null);
    const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
    const [chatInput, setChatInput] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (!socket || !session || !matchId) {
            if (status !== "Connected") return;
            router.push("/");

            return;
        }

        const joinGameAndChat = async () => {
            try {
                const match = await socket.joinMatch(matchId);

                console.log(match)
                // Join the Native Chat Room (Room Type 1)
                const chatRoom = await socket.joinChat(matchId, 1, false, false);
                setChatRoomId(chatRoom.id);

            } catch (error) {
                console.log("Failed to join match:", error);
                alert("Match expired or invalid ::" + error);

                router.push("/");
            }
        };

        joinGameAndChat();

        // listeners

        // Listen for game loop data
        socket.onmatchdata = (matchData: MatchData) => {
            const payload = JSON.parse(new TextDecoder().decode(matchData.data));

            // MatchData here corresponds to `MatchState` which is 
            // presences    []runtime.Presence 
            // board        [9]int             
            // turnCount    int              
            // mark         int                
            // mode         string           
            // deadline     int64           
            // ticksPerTurn int64              
            if (matchData.op_code === OP_UPDATE_STATE) {
                setBoard(payload.board);
                setCurrentTurn(payload.mark);

                if (session?.user_id === payload.player1) {
                    setMyPlayerNumber(1);
                } else if (session?.user_id === payload.player2) {
                    setMyPlayerNumber(2);
                }

                // MatchData now corresponds to `GameOverPayload` which is 
                // winner - int
                // reason - string
            } else if (matchData.op_code === OP_GAME_OVER) {
                setWinner(payload.winner);
                setGameOverReason(payload.reason);
            }
        };

        // Listen for messages
        socket.onchannelmessage = (msg: ChannelMessage) => {
            // ChannelMessage.content is object. so TS naturally complaints. we have to handle all cases
            const content = msg.content as { text: string };
            setMessages((prev) => [...prev, { sender: msg.username || "", text: content.text }]);
        };

        return () => {
            if (socket && matchId) socket.leaveMatch(matchId);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, matchId]);

    // --- Actions ---

    const handleSquareClick = (index: number) => {
        console.log("Square clicked:", index);
        if (!socket || !matchId || winner !== null || board[index] !== 0 || currentTurn !== myPlayerNumber) {
            console.log("Move blocked - socket:", !!socket, "matchId:", !!matchId, "winner:", winner, "board[index]:", board[index], "currentTurn:", currentTurn, "myPlayerNumber:", myPlayerNumber);
            return;
        }

        const payload = JSON.stringify({ position: index });
        console.log("Sending move:", payload);
        socket.sendMatchState(matchId, OP_MAKE_MOVE, payload);
    };

    const sendChatMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!socket || !chatRoomId || !chatInput.trim()) return;

        await socket.writeChatMessage(chatRoomId, { text: chatInput });
        setChatInput("");
    };

    // --- Helpers ---
    const isMyTurn = currentTurn === myPlayerNumber && winner === null;

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">

            {/* Header Info */}
            <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold mb-2">
                    {winner !== null ? "Game Over!" : isMyTurn ? "Your Turn!" : "Waiting for Opponent..."}
                </h2>
                {winner !== null && (
                    <p className="text-xl text-yellow-400 font-bold mb-4">
                        {winner === 0 ? "It's a Draw!" : winner === myPlayerNumber ? "You Win!" : "You Lose!"}
                        <span className="block text-sm text-gray-400 font-normal mt-1">(Reason: {gameOverReason})</span>
                    </p>
                )}
                <p className="text-gray-400">You are playing as: {myPlayerNumber === 1 ? "X" : "O"}</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">

                {/* Game Board Container (Asset target) */}
                <div className="flex-1 flex justify-center items-start">
                    <div className={`grid grid-cols-3 gap-2 bg-gray-700 p-2 rounded-xl transition-all ${!isMyTurn && winner === null ? "opacity-75 scale-95" : ""}`}>
                        {board.map((val, index) => (
                            <button
                                key={index}
                                onClick={() => handleSquareClick(index)}
                                disabled={!isMyTurn || val !== 0 || winner !== null}
                                className={`w-24 h-24 md:w-32 md:h-32 flex items-center justify-center text-5xl font-black rounded-lg transition-colors
                  ${val === 0 && isMyTurn ? "bg-gray-800 hover:bg-gray-600 cursor-pointer" : "bg-gray-800 cursor-default"}
                  ${val === 1 ? "text-blue-500" : ""}
                  ${val === 2 ? "text-red-500" : ""}
                `}
                            >
                                {val === 1 ? "X" : val === 2 ? "O" : ""}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chat Box Container */}
                <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 flex flex-col h-96 shadow-lg">
                    <div className="p-4 border-b border-gray-700 bg-gray-800 rounded-t-xl font-bold">Match Chat</div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {messages.length === 0 ? (
                            <p className="text-gray-500 text-center text-sm italic mt-4">Say hello to your opponent!</p>
                        ) : (
                            messages.map((m, i) => (
                                <div key={i} className="text-sm">
                                    <span className={`font-bold mr-2 ${m.sender === session?.username ? "text-blue-400" : "text-emerald-400"}`}>
                                        {m.sender}:
                                    </span>
                                    <span className="text-gray-200">{m.text}</span>
                                </div>
                            ))
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={sendChatMessage} className="p-3 border-t border-gray-700 flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message..."
                            maxLength={100}
                            className="flex-1 bg-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 border border-gray-700 transition-colors"
                        />
                        <button type="submit" disabled={!chatInput.trim()} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            Send
                        </button>
                    </form>
                </div>

            </div>

            {/* Leave Button */}
            {winner !== null && (
                <button
                    onClick={() => router.push("/")}
                    className="mt-8 px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-colors"
                >
                    Return to Lobby
                </button>
            )}

        </main>
    );
}