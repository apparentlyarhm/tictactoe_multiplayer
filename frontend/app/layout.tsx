import type { Metadata } from "next";
import "./globals.css";
import { NakamaProvider } from "./context/NakamaGlobalContext";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "TTT",
  description: "tic tac toe thingy",
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
          <NakamaProvider>
            {children}
          </NakamaProvider>
        </Suspense>
      </body>
    </html>
  );
}
