"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getInProgressSessionLog } from "@/lib/db/sessionLogs";
import { saveSessionLog } from "@/lib/db/sessionLogs";
import { initSyncListeners, triggerFlush } from "@/lib/sync/flush";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// §5.4: on load, a session left `en_progreso` reopens directly into the
// executor — no dashboard flash. If it's been running 6h+, ask instead of
// silently discarding or silently resuming a session the athlete may have
// simply forgotten to close days ago.
export function SessionRecoveryGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"checking" | "ready" | "stale">("checking");
  const staleSessionId = useRef<string | null>(null);

  useEffect(() => {
    initSyncListeners();

    let cancelled = false;
    (async () => {
      try {
        const session = await getInProgressSessionLog();
        if (cancelled) return;

        if (!session) {
          setPhase("ready");
          return;
        }

        const age = Date.now() - session.iniciadaEn.getTime();
        const alreadyThere = pathname === `/ejecutor/${session.id}`;

        if (age >= SIX_HOURS_MS) {
          staleSessionId.current = session.id;
          setPhase("stale");
          return;
        }

        if (!alreadyThere) {
          router.replace(`/ejecutor/${session.id}`);
        }
        setPhase("ready");
      } catch {
        setPhase("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSeguir() {
    const id = staleSessionId.current;
    setPhase("ready");
    if (id) router.replace(`/ejecutor/${id}`);
  }

  async function handleCerrar() {
    const id = staleSessionId.current;
    if (!id) {
      setPhase("ready");
      return;
    }
    const session = await getInProgressSessionLog();
    if (session && session.id === id) {
      await saveSessionLog({
        ...session,
        estado: "ABANDONADA",
        finalizadaEn: new Date(),
      });
      void triggerFlush();
    }
    setPhase("ready");
  }

  if (phase === "checking") {
    return <div className="min-h-screen bg-background" />;
  }

  if (phase === "stale") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sesión sin cerrar</CardTitle>
            <CardDescription>
              Tienes una sesión abierta desde hace más de 6 horas. ¿Sigues entrenando o la cerramos?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={handleCerrar}>
              Cerrarla
            </Button>
            <Button className="flex-1" onClick={handleSeguir}>
              Sigo entrenando
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
