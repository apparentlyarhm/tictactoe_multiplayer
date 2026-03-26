import type { Metadata } from "next";
import "./globals.css";
import { NakamaProvider } from "./context/NakamaGlobalContext";
import { Suspense } from "react";
import { Toast, toast } from '@heroui/react';

export const metadata: Metadata = {
  title: "T3",
  description: "Multiplayer Tic Tac Toe with chat and.. nothing else..",
  openGraph: {
    title: "T3",
    description: "Multiplayer Tic Tac Toe with chat and.. nothing else..",
    url: "https://t3.arhm.dev",
    images: "https://t3.arhm.dev/og.png",
    type: "website",
    locale: "en-IN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<p>Loading...</p>}>
          <Toast.Provider />
          <NakamaProvider>
            {children}
          </NakamaProvider>
        </Suspense>
      </body>
    </html>
  );
}
