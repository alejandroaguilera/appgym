"use client";

import { useEffect, useState } from "react";
import { Users, Download, Scale, Camera } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ComingSoonCard } from "@/components/shared/ComingSoonCard";
import { useUnidadPeso } from "@/lib/context/UnidadPesoContext";

export default function PerfilPage() {
  const { unidad, setUnidad } = useUnidadPeso();
  const [perfil, setPerfil] = useState<{ nombre: string; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setPerfil({ nombre: d.nombre, email: d.email }))
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-bold">Perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle>{perfil?.nombre ?? "…"}</CardTitle>
          <CardDescription>{perfil?.email ?? ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-xs uppercase tracking-wide text-muted">Unidad de peso</span>
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

      <ComingSoonCard
        icon={Scale}
        title="Métricas corporales"
        description="Peso con promedio móvil de 7 días, medidas, importación de CSV de báscula."
      />
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
      <ComingSoonCard
        icon={Download}
        title="Exportar mis datos"
        description="Token de solo lectura para tu agente coach, y export a markdown."
      />
    </div>
  );
}
