"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface BlockListItem {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  sessionTemplates: { id: string }[];
}

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  ACTIVO: "Activo",
  COMPLETADO: "Completado",
  ARCHIVADO: "Archivado",
};

export default function BloquesPage() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockListItem[] | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  async function load() {
    const res = await fetch("/api/blocks");
    const data = await res.json();
    setBlocks(data.blocks);
  }

  useEffect(() => {
    void load();
    // Leído directo de window en vez de useSearchParams para no forzar un
    // límite de Suspense en esta página estática.
    if (new URLSearchParams(window.location.search).get("guardado") === "1") {
      setShowSaved(true);
      window.history.replaceState(null, "", "/bloques");
      const t = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  async function handleNuevo() {
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Nuevo bloque",
        fechaInicio: new Date().toISOString().slice(0, 10),
        fechaFin: new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10),
        estado: "BORRADOR",
        sessionTemplates: [],
        weekOverrides: [],
      }),
    });
    const data = await res.json();
    router.push(`/bloques/${data.block.id}`);
  }

  async function handleDuplicar(id: string) {
    const res = await fetch(`/api/blocks/${id}/duplicate`, { method: "POST" });
    const data = await res.json();
    router.push(`/bloques/${data.block.id}`);
  }

  const activos = blocks?.filter((b) => b.estado === "ACTIVO") ?? [];
  const resto = blocks?.filter((b) => b.estado !== "ACTIVO") ?? [];

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/hoy" className="text-sm text-muted underline">
            ← Hoy
          </Link>
          <h1 className="text-lg font-bold">Bloques</h1>
        </div>
        <Button size="sm" onClick={handleNuevo}>
          Nuevo bloque
        </Button>
      </div>

      {blocks === null && <p className="text-sm text-muted">Cargando…</p>}

      {[...activos, ...resto].map((b) => (
        <Card key={b.id}>
          <CardHeader>
            <CardDescription>{ESTADO_LABEL[b.estado] ?? b.estado}</CardDescription>
            <CardTitle>{b.nombre}</CardTitle>
            <CardDescription>
              {b.fechaInicio.slice(0, 10)} → {b.fechaFin.slice(0, 10)} · {b.sessionTemplates.length} sesiones
            </CardDescription>
          </CardHeader>
          <div className="flex gap-3 px-5 pb-5">
            <Link href={`/bloques/${b.id}`}>
              <Button size="sm" variant="secondary">
                Editar
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => handleDuplicar(b.id)}>
              Duplicar bloque
            </Button>
          </div>
        </Card>
      ))}

      {blocks?.length === 0 && <p className="text-sm text-muted">Aún no hay bloques.</p>}

      {showSaved && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
          Bloque guardado ✓
        </div>
      )}
    </div>
  );
}
