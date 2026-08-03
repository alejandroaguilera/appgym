"use client";

// El botón "Exportar" del spec §7.2 lo usa el propio atleta desde el
// navegador — reusa el mismo endpoint autenticado por token que su agente
// coach, generando el token la primera vez si todavía no existe, en vez de
// duplicar la lógica de generación de markdown en una ruta sin auth aparte.
export async function downloadMarkdownExport(query: string, filename: string): Promise<void> {
  const settingsRes = await fetch("/api/settings");
  const settings = await settingsRes.json();
  let token: string | null = settings.exportToken;

  if (!token) {
    const regen = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateExportToken: true }),
    });
    token = (await regen.json()).exportToken;
  }

  const res = await fetch(`/api/v1/export/markdown?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
