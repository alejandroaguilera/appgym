"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { UnidadPeso } from "@/lib/units";

const STORAGE_KEY = "appgym.unidadPeso";

interface UnidadPesoContextValue {
  unidad: UnidadPeso;
  setUnidad: (u: UnidadPeso) => void;
}

const UnidadPesoContext = createContext<UnidadPesoContextValue>({
  unidad: "KG",
  setUnidad: () => {},
});

// Preferencia global de unidad (spec: "de manera global, no por
// ejercicio"). localStorage es la fuente de verdad para lectura instantánea
// (funciona offline); se sincroniza al User.unidadPeso en el servidor en
// segundo plano.
export function UnidadPesoProvider({ children }: { children: React.ReactNode }) {
  const [unidad, setUnidadState] = useState<UnidadPeso>("KG");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "KG" || stored === "LB") {
      setUnidadState(stored);
      return;
    }
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.unidadPeso === "LB" || d.unidadPeso === "KG") {
          setUnidadState(d.unidadPeso);
          window.localStorage.setItem(STORAGE_KEY, d.unidadPeso);
        }
      })
      .catch(() => {});
  }, []);

  const setUnidad = useCallback((u: UnidadPeso) => {
    setUnidadState(u);
    window.localStorage.setItem(STORAGE_KEY, u);
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unidadPeso: u }),
    }).catch(() => {});
  }, []);

  return (
    <UnidadPesoContext.Provider value={{ unidad, setUnidad }}>{children}</UnidadPesoContext.Provider>
  );
}

export function useUnidadPeso(): UnidadPesoContextValue {
  return useContext(UnidadPesoContext);
}
