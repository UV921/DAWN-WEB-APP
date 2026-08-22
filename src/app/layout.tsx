import type { Metadata, Viewport } from "next";
import { Fraunces, Sora } from "next/font/google";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "./providers";
import { PwaRegister } from "@/components/PwaRegister";
import { ReminderWatcher } from "@/components/ReminderWatcher";
import { StudyCareWatcher } from "@/components/StudyCareWatcher";
import { PushSubscriber } from "@/components/PushSubscriber";
import { DawnPushBanner } from "@/components/DawnPushBanner";
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
        <Script id="dawn-stale-chunk" strategy="beforeInteractive">
          {`(function(){function r(m){if(!/Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(m||""))return;try{if(sessionStorage.getItem("dawn-chunk-reloaded")==="11")return;sessionStorage.setItem("dawn-chunk-reloaded","11")}catch(e){}location.reload()}window.addEventListener("error",function(e){r(e.message)});window.addEventListener("unhandledrejection",function(e){var x=e.reason;r(typeof x==="string"?x:(x&&x.message)||"")});})();`}
        </Script>
        <Providers>
          {children}
          <PwaRegister />
          <PushSubscriber />
          <DawnPushBanner />
          <ReminderWatcher />
          <StudyCareWatcher />
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
