# Roadmap

Estado de lo que falta o quedó recortado contra `APP-GYM-SPEC.md`. Esto no es
un plan comprometido — es un inventario para no perder de vista qué está
simulado, aproximado, o simplemente no construido. Se actualiza en cada ronda.

## Recortes de alcance conocidos (spec vs. implementación real)

- **§6.3 Banderas activas** — el spec pide detectar estancamiento (3+
  sesiones sin progreso) y regresión (2+ sesiones cayendo). Ninguna de las
  dos está construida en ningún lado de la app. Lo único implementado es
  "molestia recurrente" (misma zona reportada 2+ veces en 14 días), que es
  el más barato de calcular y ya vive en `/api/v1/export/summary`. El resto
  vuelve como lista vacía, no simulado.
- **Área de oportunidad de crecimiento** (`app/historial/entrenamiento`,
  `dashboard-stats`) — solo compara grupos musculares que **ya tienen** al
  menos una serie registrada. No puede detectar un grupo nunca entrenado,
  porque eso requiere cruzar contra el catálogo completo de familias
  musculares (`lib/muscle-groups.ts`) en vez de solo lo que aparece en
  `SetLog`.
- **`adherencia.programadas`** en `/api/v1/export/summary` — es una
  aproximación (cuenta de `SessionTemplate` del bloque activo), no sesiones
  realmente programadas. El modelo `ScheduledSession` existe en el schema
  pero no se puebla en ningún flujo todavía — nada en la app crea filas ahí.
- **"Siguiente sesión" en el export de Markdown** — se omite (sin inventar
  valor) en dos casos: sesiones libres (`sessionTemplateId === null`, sin
  plantilla de la que sacar objetivo), y sesiones cuya plantilla original ya
  no existe o cambió (la referencia es suelta, no FK).

- **Los `WeekOverride` no se generan solos** — son filas escritas a mano
  (seed o `/bloques/[id]`). Nada lee el desempeño de la semana para proponer
  los ajustes de la siguiente; lo único automático es `calcObjetivoHoy`, que
  sube el peso **por ejercicio** contra la última sesión. El cierre de semana
  (ronda 5) entrega el resumen copiable para que ese ajuste se haga a mano
  con el coach — es el handoff, no la automatización.
- **`Block.fechaFin` ya no gobierna nada** — desde que la semana es un ciclo
  de progreso (`WeekCycle`), un bloque de 4 semanas puede seguir abriendo
  ciclos indefinidamente. No hay noción de "bloque terminado" ni transición
  automática al siguiente bloque.
- **`resolveWeekOverride` sin fila para la semana N** cae al plan base sin
  avisar. Con ciclos que pueden pasar del número de semanas que el bloque
  tenía previstas, es un caso que ahora se alcanza más fácil.

## Ideas para próximas rondas (no confirmadas con Alejandro)

- Poblar `ScheduledSession` de verdad — permitiría que "programadas" en el
  export semanal sea un número real, y abriría la puerta a un calendario de
  entrenamientos.
- Construir estancamiento/regresión (§6.3) — es el pendiente más grande del
  spec original; requiere definir la ventana de sesiones y el umbral de
  "sin progreso" antes de poder implementarlo.
- Cruzar el catálogo completo de grupos musculares contra lo entrenado para
  que "área de oportunidad" también pueda señalar grupos nunca tocados.
- Generar los `WeekOverride` de la semana siguiente desde el desempeño real
  del ciclo que se cierra (volumen, RIR alcanzado, molestias) en vez de
  depender del handoff manual del resumen.
- Marcar el fin de un bloque: hoy los ciclos siguen contando más allá de
  `fechaFin` y no hay transición al bloque siguiente.
- Este documento y `CHANGELOG.md` no se actualizan solos — recordar tocarlos
  al cerrar cada ronda futura.
