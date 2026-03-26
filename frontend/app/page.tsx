"use client"

import { useEffect, useState, } from "react";
import { useRouter } from "next/navigation";
import { useNakama } from "./context/NakamaGlobalContext";
import { main, mono, nunito } from "./config/fonts";
import clsx from "clsx";
import { Spinner, toast } from "@heroui/react";

const HELPER_TEXT: string[] = [
  "Try putting three in a row.",
  "Corners are stronger than edges. Usually.",
  "This game has been solved since forever.",
  "You are about to tie. Accept it.",
  "Thinking... just kidding, it's random matchmaking.",
  "Pro tip: Don't lose.",
  "Winning is optional. Blaming lag is mandatory.",
  "Somewhere, someone is taking this very seriously.",
  "mom how do i edit this"
];
export default function Lobby() {
  const router = useRouter();
  const { session, socket, status, updateUsername } = useNakama();

  const [isSearching, setIsSearching] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  const [selectedMode, setSelectedMode] = useState<"classic" | "timed">("classic")

  const [tipIndex, setTipIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  useEffect(() => {
    if (!isSearching) return;

    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % HELPER_TEXT.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [isSearching]);

  // --- Actions ---

  const handleUpdateName = async () => {
    if (!nicknameInput.trim() || nicknameInput === session?.username) return;
    setIsUpdatingName(true);

    try {
      await updateUsername(nicknameInput);
      toast("Nickname Updated!", {variant:"success"})

    } catch (error) {
      console.error(error);
      toast("Couldnt update username", {variant:"danger"})

    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleFindMatch = async () => {
    if (!socket) return;
    setIsSearching(true);

    try {
      await socket.addMatchmaker("*", 2, 2, { mode: selectedMode });

    } catch (error) {
      console.error("Matchmaker error:", error);
      setIsSearching(false);

      toast("Failed to join matchmaking", {variant:"danger"})
    }
  };

  // TODO: A LOT OF REPETITION IS PRESENT. I JUST WANT TO GET IT DONE. IMPROVE.
  if (isMobile) {
    return (
      <main className={`${main.className} min-h-screen bg-stone-900 text-stone-200 flex flex-col px-6 py-8`}>

        {/* TOP BAR */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Tic Tac Toe thingy</h1>

          <div
            className={`flex items-center gap-2 text-xs px-3 py-1 rounded-full border ${status === "Connected"
              ? "border-green-500 text-green-500"
              : "border-amber-500 text-amber-500"
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${status === "Connected"
                ? "bg-green-500"
                : "bg-amber-500 animate-pulse"
                }`}
            />
            {status}
          </div>
        </div>

        <div className="flex flex-col gap-6 flex-1">

          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Nickname
            </label>

            <div className="flex flex-row gap-1">

              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                disabled={!session || isSearching}
                placeholder="Enter nickname..."
                className="w-full bg-transparent border border-gray-700 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-stone-600"
              />

              <button
                onClick={handleUpdateName}
                disabled={
                  !session ||
                  isUpdatingName ||
                  isSearching ||
                  nicknameInput === session?.username
                }
                className="px-6 py-3 cursor-pointer rounded-2xl border border-stone-400 hover:border-stone-600 bg-[#B38B6B] hover:bg-[#F5F3F0] hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingName ? "Saving..." : "Save"}
              </button>

            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Mode
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedMode("classic")}
                className={`btn-3d flex-1 cursor-pointer border border-stone-400 hover:border-stone-600 py-3 rounded-2xl font-semibold transition ${selectedMode === "classic"
                  ? "bg-[#B38B6B] text-white"
                  : "bg-[#F5F3F0] text-black"
                  }`}
              >
                Classic
              </button>

              <button
                onClick={() => setSelectedMode("timed")}
                className={`btn-3d flex-1 cursor-pointer border border-stone-400 hover:border-stone-600 py-3 rounded-2xl font-semibold transition ${selectedMode === "timed"
                  ? "bg-[#B38B6B] text-white"
                  : "bg-[#F5F3F0] text-black"
                  }`}
              >
                Timed
              </button>
            </div>
          </div>

          {/* SPACER */}
          <div className="flex-1">
            {isSearching && (
              <div className="mt-6 flex flex-col gap-4">
                <p className="italic text-stone-200">Trying to find a match, not tinder tho</p>
                <Spinner size="lg" className="text-stone-200" />

                <p className="text-lg text-stone-200 max-w-xs leading-relaxed">
                  {HELPER_TEXT[tipIndex]}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleFindMatch}
            disabled={!socket || isSearching || status !== "Connected"}
            className="btn-3d w-full py-4 text-lg font-bold hover:text-[#2E232F] cursor-pointer bg-[#2E232F] hover:bg-stone-200 flex items-center justify-center gap-3"
          >
            {isSearching ? (
              <>
                <Spinner size="sm" className="text-stone-200" />
                Searching...
              </>
            ) : (
              "Find Match"
            )}
          </button>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white flex">

      <div
        className={clsx(
          "w-3/5 flex flex-col justify-between border-r transition-colors duration-500",
          isSearching
            ? "bg-stone-200 text-[#2e232f] border-gray-300"
            : "bg-[#2e232f] text-stone-200 border-stone-800",
          main.className
        )}
      >
        {/* TOP CONTENT */}
        <div className="flex flex-col gap-6 px-10 py-12">

          {/* STATUS CHIP */}
          <div className={clsx("mb-4", mono.className)}>
            <div
              className={clsx(
                "inline-flex items-center gap-2 py-2 px-6 border text-sm",
                status === "Connected"
                  ? "border-green-600 text-green-600"
                  : "border-amber-600 text-amber-600"
              )}
            >
              <span
                className={clsx(
                  "w-2 h-2 rounded-full",
                  status === "Connected" ? "bg-green-600" : "bg-amber-600"
                )}
              />
              {status}
            </div>
          </div>

          <h1
            className={clsx(
              "text-6xl font-black tracking-tight",
              isSearching ? "text-gray-900" : "text-stone-300"
            )}
          >
            Its just tic tac toe bro; Everyone knows how to play it.
          </h1>


          {isSearching && (
            <div className="mt-6 flex flex-col gap-4">
              <Spinner size="lg" className="text-[#2e232f]" />

              <p className="text-lg opacity-70 max-w-xs leading-relaxed">
                {HELPER_TEXT[tipIndex]}
              </p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="w-full pb-6 text-center text-xs opacity-60">
          <p>Documentation</p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className={clsx("w-2/5 flex flex-col bg-[#FDFCF9] justify-center px-16 py-12", nunito.className)}>
        <h1 className="font-black text-stone-700 text-3xl mb-10 ">
          Configure some options below, then try finding a match!
        </h1>
        {/* NICKNAME */}
        <div className="mb-10">
          <label className="block text-md text-stone-400 mb-3">
            Set a nickname!
          </label>

          <div className="flex gap-3">
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              disabled={!session || isSearching}
              placeholder="Enter a nickname..."
              className="flex-1 font-bold text-[#2E232F] bg-transparent border border-stone-400 rounded-full p-5 text-lg focus:outline-none focus:border-stone-600 transition"
            />

            <button
              onClick={handleUpdateName}
              disabled={
                !session ||
                isUpdatingName ||
                isSearching ||
                nicknameInput === session?.username
              }
              className="px-6 py-3 cursor-pointer rounded-2xl border border-stone-400 hover:border-stone-600 bg-[#B38B6B] hover:bg-[#F5F3F0] hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingName ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* MODE SELECT */}
        <div className="mb-10">
          <label className="block text-md text-stone-400 mb-3">
            Game Mode
          </label>

          <div className="flex gap-4">
            <button
              onClick={() => setSelectedMode("classic")}
              className={`btn-3d flex-1 cursor-pointer border border-stone-400 hover:border-stone-600 py-5 rounded-2xl font-semibold transition ${selectedMode === "classic"
                ? "bg-[#B38B6B] text-white"
                : "bg-[#F5F3F0] text-black"
                }`}
            >
              Classic
            </button>

            <button
              onClick={() => setSelectedMode("timed")}
              className={`btn-3d flex-1 cursor-pointer border border-stone-400 hover:border-stone-600 py-5 rounded-2xl font-semibold transition ${selectedMode === "timed"
                ? "bg-[#B38B6B] text-white"
                : "bg-[#F5F3F0] text-black"
                }`}
            >
              Timed
            </button>
          </div>
        </div>

        {/* FIND MATCH */}
        <button
          onClick={handleFindMatch}
          disabled={!socket || isSearching || status !== "Connected"}
          className="btn-3d p-6 text-2xl hover:text-[#2E232F] cursor-pointer bg-[#2E232F] hover:bg-stone-200"
        >
          {isSearching ? (
            <>
              Searching...
            </>
          ) : (
            "Find a Match"
          )}
        </button>

      </div>
    </main>
  );
}