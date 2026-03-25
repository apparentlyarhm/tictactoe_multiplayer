"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { Client, Session, Socket } from "@heroiclabs/nakama-js";
import { v4 as uuidv4 } from "uuid";

interface NakamaContextType {
    client: Client | null;
    session: Session | null;
    socket: Socket | null;
    status: string;
    updateUsername: (newName: string) => Promise<void>;
}

const NakamaContext = createContext<NakamaContextType | null>(null);

export const NakamaProvider = ({ children }: { children: React.ReactNode }) => {
    const [client, setClient] = useState<Client | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [status, setStatus] = useState("Initializing...");

    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        
        // on cloud run traffic goes to 8080 via 443, then to 7350 via the caddy container.
        // also needs ssl.
        const isDevMode = !!process.env.NEXT_PUBLIC_DEV_MODE;
        const port = isDevMode 
            ? (process.env.NEXT_PUBLIC_NAKAMA_PORT || "7350")
            : "443";
        const useSsl = isDevMode ? false : true;

        const cl = new Client(
            process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || "defaultkey",
            process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1",
            port,
            useSsl,
        );
        setClient(cl);

        let d = localStorage.getItem("ttt_did");

        if (!d) {
            d = uuidv4();
            localStorage.setItem("ttt_did", d);
        }

        // // makes this easier to test
        // let d = uuidv4();
        const initNakamaWithRetry = async (attempt = 1) => {
            try {

                // As of 23-3-26 my plans to deploy this would be cloud run + self hosted postgres via tailscale
                // as a result i would probably use sidecar container - that might take a lot of time to connect - 
                // from experience. so, while we wait, we can show a UI

                if (attempt > 1) {
                    setStatus(`Waking up server (Attempt ${attempt})...`);
                } else {
                    setStatus("Connecting...");
                }

                const newSession = await cl.authenticateDevice(d, true);
                setSession(newSession);

                const newSocket = cl.createSocket(false, false);
                await newSocket.connect(newSession, true);

                setSocket(newSocket);
                setStatus("Connected");

            } catch (error) {
                console.warn(`Connection attempt ${attempt} failed. Retrying in 3 seconds... details :: ${error}`);

                // If it fails, wait 3 seconds and call this function again
                if (attempt < 15) { // Try for about 45 seconds total
                    setTimeout(() => initNakamaWithRetry(attempt + 1), 3000);

                } else {
                    setStatus("Connection Failed. Matchmaker is possibly offline :(");
                }
            }
        }

        initNakamaWithRetry(); // start initialising

        return () => {
            if (socket) socket.disconnect(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateUsername = async (uname: string) => {
        if (client && session) {
            await client.updateAccount(session, { username: uname });

            // Refresh session to get the new username
            const newSession = await client.sessionRefresh(session);
            setSession(newSession);
        }
    };

    return (
        <NakamaContext.Provider value={{ client, session, socket, status, updateUsername }}>
            {children}
        </NakamaContext.Provider>
    );
};

export const useNakama = () => {
    const context = useContext(NakamaContext);
    if (!context) throw new Error("useNakama must be used within a NakamaProvider");

    return context;
};