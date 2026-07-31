"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, ClipboardList, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/hoy", label: "Hoy", icon: Home },
  { href: "/historial", label: "Historial", icon: LineChart },
  { href: "/bloques", label: "Bloques", icon: ClipboardList },
  { href: "/perfil", label: "Perfil", icon: User },
];

// Solo visible en la raíz de cada tab — nunca en el ejecutor (spec §8: nada
// debe robar espacio al pulgar mientras se registra una serie) ni en
// pantallas con su propia barra de acción fija (editor de bloque), que de
// otro modo se encimarían con esta.
export function BottomNav() {
  const pathname = usePathname();
  const isTabRoot = TABS.some((t) => pathname === t.href);
  if (!isTabRoot) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors duration-150",
                active ? "text-primary" : "text-muted"
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
