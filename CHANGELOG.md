# Changelog

Historial de rondas de desarrollo de appgym. Cada ronda corresponde a un ciclo
de uso real en el gym seguido de feedback de Alejandro. Los hashes son de
`git log`.

## Ronda 0 — Build inicial (2026-07-31)

Primera versión funcional a partir de `APP-GYM-SPEC.md`: modelo de datos,
ejecutor de sesión con outbox local (IndexedDB) para durabilidad offline,
temporizador de descanso, notificaciones al entrar al ejecutor.

- `564e848` Build inicial: modelo de datos + ejecutor durable + timer de descanso
- `92cdd2e`/`93ae753` Seed de datos vía endpoint temporal (creado y luego eliminado)
- `a1f1e82` Permiso de notificaciones al entrar al ejecutor
- `1b82b6e` Fix: la página raíz no cargaba en iOS Safari (`redirect()` de Server
  Component mal manejado por Safari — reemplazado por un 307 real en
  `next.config.ts`)
- `353dfc0` Primera ronda de feedback en iPhone 16 Pro Max
- `d9aad44` Cargar las notas por ejercicio y el contexto del bloque reales del
  plan de coaching
- `e59222b` Redondear peso en la conversión lb→kg (tanto al guardar como en el
  texto de objetivo-hoy)
- `98172af` Mostrar series/reps/RIR/descanso prescritos; fix de un default de
  calentamiento que quedaba obsoleto (closure viejo en el `useEffect` de
  precarga, corría antes de que el contexto terminara de cargar)
- `ba2a0c4` La progresión semanal ya no le impone un RIR a un ejercicio cuyo
  plan no define uno (calentamiento)
- `c95512b` Rediseño de la arquitectura de información, dashboard nuevo,
  ejecutor reconstruido como acordeón

## Ronda 2 — Normalización y lectura (2026-08-01)

- `b396680` Normalización de `grupoMuscularPrimario` a 10 familias musculares
  fijas (antes texto libre inconsistente)
- `6022071` Endpoints de lectura de sesiones (`GET /api/sessions`,
  `GET /api/sessions/[id]`)

## Ronda 3 — Historial real, kg, bugs (2026-08-03)

- `851576f` Historial real (antes placeholder), peso corporal en kg, tags
  musculares, y una serie de fixes de bugs reportados en uso real

## Ronda 4 — Archivado, Historial dividido, gráficas, export API (2026-08-03)

- `3682433` Parte 1: mecanismo de archivado de sesiones, Historial dividido en
  Entrenamiento/Corporal, gráficas SVG de métricas corporales (peso/grasa/
  masa muscular) con edición de registros, indicador de sincronización ya no
  persistente
- `96155f5` Parte 2: API de exportación de solo lectura (spec §7.1/§7.2) —
  token Bearer por usuario, 6 endpoints en `/api/v1/export/*`, export en
  Markdown

### Bug encontrado y arreglado durante la verificación de esta ronda

Al agregar el archivado, el nuevo `PUT /api/sessions/[id]` (archivar/
desarchivar) **reemplazó sin querer** el `PUT` que ya existía en esa misma
ruta para sincronizar el cierre de sesión (`upsertSessionLog` +
`detectAndSavePRs`). El cierre normal de sesión dejó de guardar nada por esa
vía — solo seguía funcionando el fallback de emergencia (`sendBeacon` al
salir de pantalla), lo que generó PRs duplicados por reintentos sin
protección compartida entre las dos vías.

- `f36a6ec` Primer intento de fix (guarda por `setLogId` — insuficiente, no
  cubría empates de peso ni PRs tipo VOLUMEN)
- `2006544` Limpieza puntual #1 (295 de 408 duplicados)
- `aa542f2` **Fix real**: `PUT` vuelve a ser sincronización de sesión,
  `PATCH` es archivar/restaurar (verbos separados, ya no compiten). Guarda de
  idempotencia reemplazada por un reclamo atómico de un solo uso
  (`SessionLog.prsDetectadosEn`, nueva columna) — cierra la ventana de
  carrera entre el fetch inmediato del ejecutor y el fallback de beacon.
- `a0b6ce6` Backfill de `prsDetectadosEn` para sesiones cerradas antes de que
  existiera la columna (encontrado al verificar en vivo: un reenvío tardío
  del outbox local podía volver a disparar la detección sobre una sesión
  vieja)
- `1c15842` Limpieza puntual #2 (41 duplicados adicionales por empates de
  peso, 22 sesiones con backfill) — endpoint temporal eliminado tras
  confirmar una segunda corrida en cero
