import type { Metadata, Viewport } from "next";
import { Fraunces, Sora } from "next/font/google";
import { Providers } from "./providers";
import { PwaRegister } from "@/components/PwaRegister";
import { ReminderWatcher } from "@/components/ReminderWatcher";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dawn — Morning habit accountability",
  description:
    "Wake early, sleep early, gym, reading — streaks, graphs, and Discord friend accountability.",
  manifest: "/manifest.webmanifest",
  applicationName: "Dawn",
  appleWebApp: {
    capable: true,
    title: "Dawn",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#071018",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${fraunces.variable} ${sora.variable}`}>
      <body
        className="antialiased"
        style={
          {
            "--font-display": "var(--font-fraunces), Georgia, serif",
            "--font-body": "var(--font-sora), system-ui, sans-serif",
          } as React.CSSProperties
        }
      >
        <Providers>
          {children}
          <PwaRegister />
          <ReminderWatcher />
        </Providers>
      </body>
    </html>
  );
}
