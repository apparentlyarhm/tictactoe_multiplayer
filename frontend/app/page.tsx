"use client"

import { useEffect, useState,  } from "react";
import { useRouter } from "next/navigation";
import { useNakama } from "./context/NakamaGlobalContext";

export default function Lobby() {
  const router = useRouter();
  const { session, socket, status, updateUsername } = useNakama();

  const [isSearching, setIsSearching] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  useEffect(() => {
    if (session?.username) {
      setNicknameInput(session.username);
    }
  }, [session?.username]);

  useEffect(() => {
    if (!socket) return;

    socket.onmatchmakermatched = async (matched) => {
      setIsSearching(false);
      
      router.push(`/game?matchId=${matched.match_id}`);
    };
  }, [socket, router]);

  // --- Actions ---

  const handleUpdateName = async () => {
    if (!nicknameInput.trim() || nicknameInput === session?.username) return;
    setIsUpdatingName(true);
    
    try {
      await updateUsername(nicknameInput);
      alert("Nickname updated!");

    } catch (error) {
      console.error(error);
      alert("Failed to update nickname. Try another one.");

    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleFindMatch = async () => {
    if (!socket) return;
    setIsSearching(true);

    try {
      await socket.addMatchmaker("*", 2, 2, { mode: "classic" });

    } catch (error) {
      console.error("Matchmaker error:", error);
      setIsSearching(false);

      alert("Failed to join matchmaking.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-emerald-400 mb-2">
            Tic-Tac-Toe
          </h1>
          <p className="text-sm font-mono text-gray-400 flex items-center justify-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === "Connected" ? "bg-green-500" : "bg-red-500 animate-pulse"}`}></span>
            {status}
          </p>
        </div>

        {/* Slither.io style Nickname Input */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Your Nickname</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter a nickname..."
              disabled={!session || isSearching}
            />
            <button
              onClick={handleUpdateName}
              disabled={!session || isUpdatingName || isSearching || nicknameInput === session?.username}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isUpdatingName ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* The Big Play Button */}
        <button
          onClick={handleFindMatch}
          disabled={!socket || isSearching || status !== "Connected"}
          className="w-full py-4 bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg font-bold text-xl transition-all shadow-lg disabled:opacity-50 relative overflow-hidden group"
        >
          {isSearching ? (
             <span className="flex items-center justify-center gap-3">
               <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Searching for Opponent...
             </span>
          ) : (
             "Find Match"
          )}
        </button>

      </div>
    </main>
  );
}