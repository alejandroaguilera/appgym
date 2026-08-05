"use client";

import { useEffect, useRef } from "react";

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  color: string;
}

// Verde primario de la app y dos acentos cálidos, para que la fiesta se sienta
// parte de la misma paleta y no un confeti genérico pegado encima.
const COLORES = ["#7de07d", "#b9f5a3", "#ffd166", "#ff9f68", "#8fd3ff"];

const GRAVEDAD = 0.055;
const FRICCION = 0.985;
const DURACION_MS = 7_000;
const INTERVALO_ESTALLIDO_MS = 620;

function estallido(x: number, y: number): Particula[] {
  const color = COLORES[Math.floor(Math.random() * COLORES.length)];
  const total = 44 + Math.floor(Math.random() * 22);
  return Array.from({ length: total }, (_, i) => {
    const angulo = (Math.PI * 2 * i) / total + Math.random() * 0.12;
    const velocidad = 1.6 + Math.random() * 3.4;
    return {
      x,
      y,
      vx: Math.cos(angulo) * velocidad,
      vy: Math.sin(angulo) * velocidad,
      vida: 1,
      color,
    };
  });
}

// Canvas propio en vez de una librería de animación: el proyecto no tiene
// ninguna (ni framer-motion) y no vale la pena agregar una para esto.
export function FireworksCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // El kill-switch de prefers-reduced-motion vive en globals.css y es CSS —
    // no alcanza a un canvas, así que aquí se consulta a mano. Sin animación
    // el overlay sigue funcionando: el mensaje es lo que importa.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let ancho = 0;
    let alto = 0;

    const redimensionar = () => {
      ancho = canvas.clientWidth;
      alto = canvas.clientHeight;
      canvas.width = ancho * dpr;
      canvas.height = alto * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    redimensionar();
    window.addEventListener("resize", redimensionar);

    let particulas: Particula[] = [];
    let frame = 0;
    let ultimoEstallido = 0;
    const inicio = performance.now();

    // Los dos primeros salen de inmediato: si el atleta tuviera que esperar
    // medio segundo a que empiece la fiesta, ya leyó el mensaje y se perdió.
    particulas.push(...estallido(ancho * 0.32, alto * 0.32));
    particulas.push(...estallido(ancho * 0.7, alto * 0.42));

    const animar = (ahora: number) => {
      const transcurrido = ahora - inicio;

      if (transcurrido < DURACION_MS && ahora - ultimoEstallido > INTERVALO_ESTALLIDO_MS) {
        ultimoEstallido = ahora;
        particulas.push(
          ...estallido(ancho * (0.18 + Math.random() * 0.64), alto * (0.16 + Math.random() * 0.4))
        );
      }

      ctx.clearRect(0, 0, ancho, alto);

      for (const p of particulas) {
        p.vx *= FRICCION;
        p.vy = p.vy * FRICCION + GRAVEDAD;
        p.x += p.vx;
        p.y += p.vy;
        p.vida -= 0.0115;

        if (p.vida <= 0) continue;
        ctx.globalAlpha = Math.max(0, p.vida);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      particulas = particulas.filter((p) => p.vida > 0 && p.y < alto + 40);

      if (transcurrido < DURACION_MS || particulas.length > 0) {
        frame = requestAnimationFrame(animar);
      }
    };

    frame = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", redimensionar);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
