// Familia fija de grupos musculares primarios. Antes `grupoMuscularPrimario`
// era texto libre y se fragmentaba ("espalda" vs "espalda (dorsal)", "hombro"
// vs "hombro posterior" vs "hombro (deltoides lateral)"), lo que diluía
// cualquier agregación por grupo (p.ej. el stat de "área más entrenada" del
// dashboard). Validar contra esta lista en el único punto de escritura
// (PUT /api/exercises/[id]) evita que vuelva a pasar sin necesitar una
// migración de esquema a enum.
export const GRUPOS_MUSCULARES = [
  "pecho",
  "espalda",
  "hombro",
  "bíceps",
  "tríceps",
  "cuádriceps",
  "isquiotibiales",
  "glúteo",
  "pantorrilla",
  "core",
] as const;

export type GrupoMuscular = (typeof GRUPOS_MUSCULARES)[number];
