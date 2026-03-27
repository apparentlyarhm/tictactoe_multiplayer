import { useEffect, useState } from "react";
import { mono } from "../config/fonts";

interface DesktopClockProps {
    gameMode: "classic" | "timed";
    deadlineMs: number;
    isActiveTurn: boolean; // True if it's currently this player's turn
}

interface MobileClockProps {
    gameMode: "classic" | "timed";
    deadlineMs: number;
    isActiveTurn: boolean;
}

export function DesktopClock({ gameMode, deadlineMs, isActiveTurn }: DesktopClockProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        if (gameMode !== "timed" || !deadlineMs || !isActiveTurn) return;

        // Update 10 times a second for a highly responsive UI
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
            setTimeLeft(remaining);
        }, 100);

        return () => clearInterval(interval);
    }, [deadlineMs, gameMode, isActiveTurn]);

    if (gameMode !== "timed") return null;

    // Visual styles based on state
    const isDanger = timeLeft <= 5 && isActiveTurn;
    
    return (
        <div className={`
            ${mono.className}
            flex flex-col items-center bg-transparent justify-center p-4 rounded-xl border-2 w-32 shadow-lg transition-all
            ${isActiveTurn ? ' border-blue-500 scale-105' : ' border-slate-700 opacity-50'}
            ${isDanger ? 'border-red-500 animate-pulse' : ''}
        `}>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                {isActiveTurn ? "Your Turn" : "Waiting..."}
            </span>
            <span className={`text-4xl  font-bold ${isDanger ? 'text-red-400' : 'text-white'}`}>
                {isActiveTurn ? `${timeLeft}s` : '--'}
            </span>
        </div>
    );
}

export function MobileClock({ gameMode, deadlineMs, isActiveTurn }: MobileClockProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        if (gameMode !== "timed" || !deadlineMs || !isActiveTurn) return;

        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
            setTimeLeft(remaining);
        }, 100);

        return () => clearInterval(interval);
    }, [deadlineMs, gameMode, isActiveTurn]);

    if (gameMode !== "timed") return null;

    const isDanger = timeLeft <= 5 && isActiveTurn;

    return (
        <div className={`
            ${mono.className}
            flex items-center space-x-2 px-4 bg-transparent py-1.5 rounded-full text-sm font-bold shadow-md transition-colors
            ${isActiveTurn ? ' text-white' : 'text-slate-400'}
            ${isDanger ? 'bg-red-600 animate-pulse' : ''}
        `}> 
            <span className="">
                {isActiveTurn ? `00:${timeLeft.toString().padStart(2, '0')}` : 'Waiting'}
            </span>
        </div>
    );
}