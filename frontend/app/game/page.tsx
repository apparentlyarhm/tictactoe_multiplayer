"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNakama } from "../context/NakamaGlobalContext";
import { MatchData, ChannelMessage } from "@heroiclabs/nakama-js";
import clsx from "clsx";
import { main, mono, nunito } from "../config/fonts";

const OP_UPDATE_STATE = 1;
const OP_MAKE_MOVE = 2;
const OP_GAME_OVER = 3;

export default function GameRoom() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { session, socket, status } = useNakama();

    const matchId = searchParams.get("matchId");
    const isDev = searchParams.get("dev") === "true";
    const [isMobile, setIsMobile] = useState(false);

    // Game State
    const [board, setBoard] = useState<number[]>(
        isDev ? [1, 2, 0, 0, 1, 0, 2, 0, 0] : [0, 0, 0, 0, 0, 0, 0, 0, 0]
    );

    const [currentTurn, setCurrentTurn] = useState<number>(1);
    const [myPlayerNumber, setMyPlayerNumber] = useState<number>(isDev ? 1 : 0); // 1 for X, 2 for O
    const [winner, setWinner] = useState<number | null>(null);
    const [gameOverReason, setGameOverReason] = useState<string>("");

    // Chat State
    const [chatRoomId, setChatRoomId] = useState<string | null>(isDev ? "mock-room" : null);
    const [messages, setMessages] = useState<{ sender: string; text: string }[]>(
        isDev ? [
            { sender: "Opponent", text: "GLHF!" },
            { sender: "You", text: "Let's go!" }
        ] : []
    );

    const [chatInput, setChatInput] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);


    // Mobile detection
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Auto-scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        // global fallback
        if (isDev) return;

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

        if (isDev) {
            const newBoard = [...board];
            newBoard[index] = myPlayerNumber;
            setBoard(newBoard);
            setCurrentTurn(myPlayerNumber === 1 ? 2 : 1); // Swap turn locally
            return;
        }

        if (!socket || !matchId || winner !== null || board[index] !== 0 || currentTurn !== myPlayerNumber) {
            return;
        }

        const payload = JSON.stringify({ position: index });
        socket.sendMatchState(matchId, OP_MAKE_MOVE, payload);
    };

    const sendChatMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!socket || !chatRoomId || !chatInput.trim()) return;

        if (isDev) {
            setMessages((prev) => [...prev, { sender: "You", text: chatInput }]);
            setChatInput("");
            return;
        }

        await socket.writeChatMessage(chatRoomId, { text: chatInput });
        setChatInput("");
    };

    // --- Helpers ---
    const isMyTurn = currentTurn === myPlayerNumber && winner === null;

    if (isMobile) {
        return (
            <main className="min-h-dvh flex flex-col bg-[#FDFCF9]">

                <div
                    className={clsx(
                        "w-full flex flex-col items-center bg-[#2e232f] text-stone-200 border-b border-stone-800 px-4 py-6",
                        main.className
                    )}
                >
                    <div className="flex flex-col items-center text-center">
                        <h1 className="text-2xl font-black tracking-tight text-stone-300">
                            {winner !== null
                                ? winner === 0
                                    ? "It's a Draw!"
                                    : winner === myPlayerNumber
                                        ? "You Win!"
                                        : "You Lose!"
                                : isMyTurn
                                    ? "Make your move."
                                    : "Waiting for opponent..."}
                        </h1>

                        {winner !== null && (
                            <p className="text-sm text-stone-400 mt-1 font-medium">
                                Reason: {gameOverReason}
                            </p>
                        )}

                        <p className="text-stone-500 mt-2 text-sm">
                            You are playing as:{" "}
                            <strong className="text-stone-300">
                                {myPlayerNumber === 1 ? "X" : "O"}
                            </strong>
                        </p>
                    </div>

                    {/* GAME BOARD CONTAINER */}
                    <div className="flex justify-center mt-6">
                        <div
                            className={clsx(
                                "grid grid-cols-3 gap-2 bg-[#3a2c3b] p-3 rounded-2xl border border-stone-700 shadow-xl transition-all",
                                !isMyTurn && winner === null ? "opacity-80 scale-[0.98]" : ""
                            )}
                        >
                            {board.map((val, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSquareClick(index)}
                                    disabled={!isMyTurn || val !== 0 || winner !== null}
                                    className={clsx(
                                        "w-20 h-20 flex items-center justify-center text-5xl font-black rounded-xl transition-all border",
                                        val === 0 && isMyTurn && winner === null
                                            ? "bg-[#2e232f] border-stone-600 active:bg-[#433345]"
                                            : "bg-[#251c26] border-stone-800 opacity-90",
                                        val === 1 ? "text-stone-200" : "",
                                        val === 2 ? "text-[#B38B6B]" : ""
                                    )}
                                >
                                    {val === 1 ? "X" : val === 2 ? "O" : ""}
                                </button>
                            ))}
                        </div>
                    </div>

                    {winner !== null && (
                        <button
                            onClick={() => router.push("/")}
                            className="mt-6 px-6 py-3 text-sm font-bold rounded-xl border border-stone-400 bg-[#F5F3F0] text-[#2E232F] active:bg-stone-300 transition"
                        >
                            Return to Lobby
                        </button>
                    )}
                </div>

                <div
                    className={clsx(
                        "w-full flex-1 flex flex-col px-4 py-6",
                        nunito.className
                    )}
                >
                    <h1 className="font-black text-stone-700 text-xl mb-4">Match Chat</h1>

                    {/* CHAT MESSAGES AREA */}
                    <div className="flex-1 min-h-50 max-h-75 overflow-y-auto mb-4 border border-stone-300 rounded-2xl p-4 bg-white shadow-sm flex flex-col space-y-2">
                        {messages.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-stone-400 text-sm italic font-medium text-center">
                                    Say hello to your opponent!
                                </p>
                            </div>
                        ) : (
                            messages.map((m, i) => {
                                const isMe = m.sender === session?.username;
                                return (
                                    <div key={i} className="text-sm">
                                        <span
                                            className={clsx(
                                                "font-black mr-2",
                                                isMe ? "text-[#B38B6B]" : "text-stone-400"
                                            )}
                                        >
                                            {m.sender}:
                                        </span>
                                        <span className="text-stone-700 font-semibold">{m.text}</span>
                                    </div>
                                );
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* CHAT INPUT FORM */}
                    <form onSubmit={sendChatMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message..."
                            maxLength={100}
                            className="flex-1 font-bold text-[#2E232F] bg-transparent border border-stone-400 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-stone-600 transition"
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim()}
                            className="px-5 py-2.5 rounded-full border border-stone-400 bg-[#B38B6B] text-white text-sm font-bold transition disabled:opacity-50"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen text-white flex">
            <div
                className={clsx(
                    "md:w-1/2 lg:w-3/5 flex flex-col justify-between border-r bg-[#2e232f] text-stone-200 border-stone-800 transition-colors duration-500",
                    main.className
                )}
            >
                <div className="flex flex-col h-full px-6 py-8 lg:px-10 lg:py-12">

                    <div className="flex flex-col">
                        
                        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black tracking-tight text-stone-300">
                            {winner !== null
                                ? winner === 0
                                    ? "It's a Draw!"
                                    : winner === myPlayerNumber
                                        ? "You Win!"
                                        : "You Lose!"
                                : isMyTurn
                                    ? "Make your move."
                                    : "Waiting for opponent..."}
                        </h1>

                        {winner !== null && (
                            <p className="text-lg lg:text-xl text-stone-400 mt-2 font-medium">
                                Reason: {gameOverReason}
                            </p>
                        )}

                        <p className="text-stone-500 mt-4 text-base lg:text-lg">
                            You are playing as:{" "}
                            <strong className="text-stone-300">
                                {myPlayerNumber === 1 ? "X" : "O"}
                            </strong>
                        </p>
                    </div>

                    <div className="flex-1 flex justify-center items-center mt-6 lg:mt-8">
                        <div
                            className={clsx(
                                "grid grid-cols-3 gap-2 lg:gap-3 bg-[#3a2c3b] p-3 lg:p-4 rounded-3xl border border-stone-700 shadow-2xl transition-all",
                                !isMyTurn && winner === null ? "opacity-80 scale-[0.98]" : ""
                            )}
                        >
                            {board.map((val, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSquareClick(index)}
                                    disabled={!isMyTurn || val !== 0 || winner !== null}
                                    className={clsx(
                                        "w-20 h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 xl:w-36 xl:h-36 flex items-center justify-center text-5xl lg:text-6xl xl:text-7xl font-black rounded-2xl transition-all border",
                                        val === 0 && isMyTurn && winner === null
                                            ? "bg-[#2e232f] border-stone-600 hover:border-stone-400 hover:bg-[#433345] cursor-pointer shadow-inner"
                                            : "bg-[#251c26] border-stone-800 cursor-default opacity-90",
                                        val === 1 ? "text-stone-200" : "",
                                        val === 2 ? "text-[#B38B6B]" : ""
                                    )}
                                >
                                    {val === 1 ? "X" : val === 2 ? "O" : ""}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* LEAVE BUTTON */}
                    <div className="mt-6 lg:mt-8 flex justify-start">
                        {winner !== null && (
                            <button
                                onClick={() => router.push("/")}
                                className="btn-3d px-6 py-3 lg:px-10 lg:py-5 text-lg lg:text-xl font-bold rounded-2xl border border-stone-400 hover:border-stone-600 bg-[#F5F3F0] text-[#2E232F] hover:bg-stone-300 transition"
                            >
                                Return to Lobby
                            </button>
                        )}
                    </div>

                </div>
            </div>

            <div
                className={clsx(
                    "md:w-1/2 lg:w-2/5 flex flex-col bg-[#FDFCF9] px-6 py-8 lg:px-12 lg:py-12 max-h-screen",
                    nunito.className
                )}
            >
                <h1 className="font-black text-stone-700 text-2xl lg:text-3xl mb-4 lg:mb-8">
                    Match Chat
                </h1>

                {/* CHAT MESSAGES AREA */}
                <div className="flex-1 overflow-y-auto mb-6 lg:mb-8 border border-stone-300 rounded-2xl lg:rounded-3xl p-4 lg:p-6 bg-white shadow-sm flex flex-col space-y-3 lg:space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-stone-400 text-base lg:text-lg italic font-medium">
                                Say hello to your opponent!
                            </p>
                        </div>
                    ) : (
                        messages.map((m, i) => {
                            const isMe = m.sender === session?.username;
                            return (
                                <div key={i} className="text-base lg:text-lg">
                                    <span
                                        className={clsx(
                                            "font-black mr-2",
                                            isMe ? "text-[#B38B6B]" : "text-stone-400"
                                        )}
                                    >
                                        {m.sender}:
                                    </span>
                                    <span className="text-stone-700 font-semibold">{m.text}</span>
                                </div>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* CHAT INPUT FORM */}
                <div className="shrink-0">
                    <label className="block text-sm lg:text-md font-bold text-stone-400 mb-2 lg:mb-3">
                        Send a message
                    </label>
                    <form onSubmit={sendChatMessage} className="flex flex-col xl:flex-row gap-3">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message..."
                            maxLength={100}
                            className="flex-1 font-bold text-[#2E232F] bg-transparent border border-stone-400 rounded-2xl xl:rounded-full px-4 py-3 lg:px-6 lg:py-4 text-base lg:text-lg focus:outline-none focus:border-stone-600 transition"
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim()}
                            className="px-6 py-3 lg:px-8 lg:py-4 cursor-pointer rounded-2xl xl:rounded-full border border-stone-400 hover:border-stone-600 bg-[#B38B6B] hover:bg-[#F5F3F0] hover:text-black text-white text-base lg:text-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}