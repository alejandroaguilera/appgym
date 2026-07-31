import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionRecoveryGate } from "@/components/shared/SessionRecoveryGate";
import { SyncStatusIndicator } from "@/components/shared/SyncStatusIndicator";
import { ServiceWorkerRegistrar } from "@/components/shared/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "AppGym",
  description: "Planea, ejecuta y analiza tu entrenamiento de fuerza.",
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegistrar />
        <SessionRecoveryGate>{children}</SessionRecoveryGate>
        <SyncStatusIndicator />
      </body>
    </html>
  );
}
