import { NextRequest, NextResponse } from "next/server";
import { upsertSessionLog, deleteSessionLog } from "@/lib/services/sessionLog";
import { upsertSetLog, deleteSetLog } from "@/lib/services/setLog";
import { detectAndSavePRs } from "@/lib/services/closeSession";

interface BeaconItem {
  method: "PUT" | "DELETE" | "POST";
  url: string;
  body: unknown;
}

const SESSION_RE = /^\/api\/sessions\/([^/]+)$/;
const SET_RE = /^\/api\/sessions\/([^/]+)\/sets\/([^/]+)$/;

// Replays whatever was still pending in the client outbox at the moment of
// pagehide teardown, via navigator.sendBeacon. Uses the exact same
// idempotent service functions as the normal PUT routes — this is a
// best-effort delivery *fallback*, never the durability mechanism itself
// (that's the synchronous IndexedDB write, per §5.1).
export async function POST(req: NextRequest) {
  let items: BeaconItem[];
  try {
    items = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  for (const item of items) {
    try {
      const setMatch = item.url.match(SET_RE);
      const sessionMatch = item.url.match(SESSION_RE);

      if (setMatch) {
        const [, sessionLogId] = setMatch;
        if (item.method === "DELETE") {
          const body = item.body as { id?: string } | null;
          const setId = setMatch[2];
          await deleteSetLog(body?.id ?? setId);
        } else {
          await upsertSetLog(sessionLogId, item.body as never);
        }
      } else if (sessionMatch) {
        // El DELETE debe distinguirse aquí o el batch reconstruye lo que el
        // atleta acaba de descartar: los PUT previos de la misma sesión vienen
        // antes en el lote, y sin esta rama el DELETE caería en upsert con
        // body null — falla, se traga, y la sesión queda revivida.
        if (item.method === "DELETE") {
          await deleteSessionLog(sessionMatch[1]);
        } else {
          const sessionLog = await upsertSessionLog(item.body as never);
          if (sessionLog.estado === "COMPLETADA") {
            await detectAndSavePRs(sessionLog.id, sessionLog.atletaId);
          }
        }
      }
    } catch {
      // Best-effort: a single bad item in the beacon batch shouldn't drop
      // the rest. The normal outbox drain will retry it on next load anyway.
      continue;
    }
  }

  return NextResponse.json({ ok: true });
}
