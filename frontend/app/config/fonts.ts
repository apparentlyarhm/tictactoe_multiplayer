import { IBM_Plex_Sans, JetBrains_Mono, Nunito } from "next/font/google";

export const mono = JetBrains_Mono({
  variable: "--font-jb-mono",
  subsets: ["latin"],
});

export const main = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
})

export const nunito = Nunito({
  weight: ["500","600","700","800","900"],
  subsets: ["latin"],
})