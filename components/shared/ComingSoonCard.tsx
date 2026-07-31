import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface ComingSoonCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Esqueleto de secciones futuras del roadmap — visibles aunque no estén
// implementadas todavía, para que la app no se sienta vacía/incompleta.
export function ComingSoonCard({ icon: Icon, title, description }: ComingSoonCardProps) {
  return (
    <Card className="opacity-70">
      <CardHeader className="flex-row items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised">
          <Icon className="size-5 text-muted" />
        </div>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}
