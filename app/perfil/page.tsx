"use client";

import { useEffect, useState } from "react";
import { Users, Download, Camera, Copy, RotateCw, Check, Archive, ArchiveRestore } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { ComingSoonCard } from "@/components/shared/ComingSoonCard";
import { useUnidadPeso } from "@/lib/context/UnidadPesoContext";

interface Settings {
  nombre: string;
  email: string;
  exportToken: string | null;
}

interface ArchivedSession {
  id: string;
  iniciadaEn: string;
  volumenKg: number;
  sessionTemplate: { clave: string; nombre: string } | null;
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

export default function PerfilPage() {
  const { unidad, setUnidad } = useUnidadPeso();
  const [perfil, setPerfil] = useState<Settings | null>(null);
  const [archivadas, setArchivadas] = useState<ArchivedSession[] | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [regenerando, setRegenerando] = useState(false);

  async function loadSettings() {
    const res = await fetch("/api/settings");
    setPerfil(await res.json());
  }

  async function loadArchivadas() {
    const res = await fetch("/api/sessions?estado=COMPLETADA&archivadas=1&limit=50");
    setArchivadas((await res.json()).sessions);
  }

  useEffect(() => {
    void loadSettings();
    void loadArchivadas();
  }, []);

  async function handleRegenerar() {
    setRegenerando(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateExportToken: true }),
    });
    await loadSettings();
    setRegenerando(false);
  }

  async function handleCopiar() {
    if (!perfil?.exportToken) return;
    await navigator.clipboard.writeText(perfil.exportToken);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function handleRestaurar(id: string) {
    await fetch(`/api/sessions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivada: false }),
    });
    setArchivadas((prev) => prev?.filter((s) => s.id !== id) ?? null);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-bold">Perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle>{perfil?.nombre ?? "…"}</CardTitle>
          <CardDescription>{perfil?.email ?? ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-xs uppercase tracking-wide text-muted">Unidad de peso (ejercicios)</span>
          <div className="mt-1.5 flex gap-2">
            <Chip selected={unidad === "KG"} onClick={() => setUnidad("KG")}>
              kg
            </Chip>
            <Chip selected={unidad === "LB"} onClick={() => setUnidad("LB")}>
              lb
            </Chip>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4" />
            Exportar mis datos
          </CardTitle>
          <CardDescription>
            Token de solo lectura para tu agente coach — <code>GET /api/v1/export/*</code> con header{" "}
            <code>Authorization: Bearer &lt;token&gt;</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {perfil?.exportToken ? (
            <div className="flex items-center gap-2 rounded-xl bg-surface-raised px-3 py-2">
              <code className="flex-1 truncate text-xs">{perfil.exportToken}</code>
              <button onClick={handleCopiar} aria-label="Copiar token" className="shrink-0 text-muted">
                {copiado ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">Sin token generado todavía.</p>
          )}
          <Button variant="secondary" size="sm" onClick={handleRegenerar} disabled={regenerando}>
            <RotateCw className="size-4" />
            {perfil?.exportToken ? "Regenerar (invalida el anterior)" : "Generar token"}
          </Button>
        </CardContent>
      </Card>

      <ComingSoonCard
        icon={Camera}
        title="Fotos de progreso"
        description="Privadas, nunca expuestas en ninguna API ni export."
      />
      <ComingSoonCard
        icon={Users}
        title="Vínculo con coach"
        description="Invitar a un coach para que vea tu progreso y comente sesiones."
      />

      <div className="mt-2 flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
          <Archive className="size-3.5" />
          Archivado
        </p>
        {archivadas === null && <p className="text-sm text-muted">Cargando…</p>}
        {archivadas?.length === 0 && <p className="text-sm text-muted">Nada archivado.</p>}
        {archivadas?.map((s) => (
          <Card key={s.id} className="flex items-center justify-between p-3">
            <span className="text-sm">
              {s.sessionTemplate ? `Sesión ${s.sessionTemplate.clave}` : "Sesión libre"} ·{" "}
              {FECHA_CORTA.format(new Date(s.iniciadaEn))} · {Math.round(s.volumenKg)} kg
            </span>
            <button
              onClick={() => handleRestaurar(s.id)}
              aria-label="Restaurar sesión"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted"
            >
              <ArchiveRestore className="size-4" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
