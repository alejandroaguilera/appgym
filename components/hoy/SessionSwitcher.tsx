import { Chip } from "@/components/ui/chip";

interface SessionTemplateOption {
  id: string;
  clave: string;
  nombre: string;
}

interface SessionSwitcherProps {
  templates: SessionTemplateOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onSesionLibre: () => void;
}

// Chips secundarios: cambiar a otra sesión · sesión libre (spec §4.1) — el
// calendario propone, no impone.
export function SessionSwitcher({ templates, selectedId, onSelect, onSesionLibre }: SessionSwitcherProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {templates.map((t) => (
        <Chip key={t.id} selected={t.id === selectedId} onClick={() => onSelect(t.id)}>
          {t.clave}
        </Chip>
      ))}
      <Chip onClick={onSesionLibre}>Sesión libre</Chip>
    </div>
  );
}
