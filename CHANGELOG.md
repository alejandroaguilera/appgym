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

## Ronda 4 — Los tres fallos del export (2026-08-04)

Reportado desde el hub de Coach Alejandro: el export automático llevaba dos
corridas seguidas en `PARCIAL`, 3 de 5 endpoints (`exports/_export.log`). Los
tres fallos eran independientes, pero dos compartían raíz: **fechas calculadas
en UTC cuando el atleta entrena en `America/Mexico_City` (UTC-6)**.

- `59fad1a` Arreglo de los tres fallos.

**`/api/v1/export/sessions` — 200 con datos incompletos (el bug principal).**
`lte: new Date(hasta)` cortaba el rango en la medianoche UTC del día `hasta`,
que en México son las **6 p.m. del día anterior**. La sesión de pierna del 3 de
agosto cerró a las 6:44 p.m. y quedaba fuera por 44 minutos — por eso el
detector de PRs sí la veía y el export no. En general, ningún entrenamiento
posterior a las 6 p.m. locales aparecía en un export del mismo día. Se filtra
ahora por `iniciadaEn` (NOT NULL, y el campo que el payload ya expone como
fecha de la sesión) sobre límites `[gte, lt)` que cubren los días calendario
locales completos, vía el nuevo `localDateRangeBounds` en `lib/date.ts`.

**`/api/v1/export/summary?semana=2026-W32` — HTTP 500.** `new Date("2026-W32")`
es `Invalid Date`: JS no parsea identificadores de semana ISO, y el `NaN`
llegaba hasta Prisma como un `DateTime` inválido. `computeWeekRange` ahora
parsea `YYYY-Www` además de `YYYY-MM-DD`, calcula los límites en huso local (la
ventana UTC anterior iba de domingo 6 p.m. a domingo 5:59 p.m. local, metiendo
los entrenamientos de domingo por la tarde en la semana equivocada) y devuelve
`null` ante entrada no reconocida, para responder 400 en vez de 500.

**`/api/v1/export/markdown?tipo=sesiones` — HTTP 400.** Desajuste de contrato:
el route solo aceptaba `log` y `semanal`. Se agregó la rama, que devuelve
`text/markdown` con la bitácora de cada sesión de la semana separada por `---`,
reusando `generarMarkdownSesion`. Semana vacía devuelve una línea, nunca un
body vacío (el script del hub descarta archivos de cero bytes). Las consultas
de apoyo se hacen en lote para no pagar una por ejercicio por sesión.

`/api/v1/export/metrics` se dejó intacto a propósito: `BodyMetric.fecha` es
`@db.Date`, donde `new Date("2026-08-04")` sí es el límite correcto. Por lo
mismo, las comparaciones contra esa columna en summary y markdown pasan ahora
por `toDateOnlyUTC` en vez de usar los límites con el offset del huso
incrustado.

Verificado en producción: con `desde=2026-05-05`, `hasta=2026-08-02` devuelve
los mismos 6387 bytes que reportaban las dos corridas rotas, y `hasta=2026-08-03`
devuelve 9562 bytes con la sesión de pierna y sus 7 ejercicios.

## Ronda 5 — La semana deja de ser calendario (2026-08-05)

Cinco síntomas del feedback tras la primera semana real de uso, tres de ellos
con la misma raíz: **la app no tenía un concepto de semana de entrenamiento**,
solo aritmética de calendario.

- `311b49b` La semana pasa de calendario a ciclo de progreso, descarte de
  sesión y celebración semanal

**El desfase de modelo.** `numeroSemana` era
`floor((hoy − block.fechaInicio) / 7 días) + 1`: puro reloj. Si Alejandro
tardaba semana y media en hacer sus 4 sesiones, al día 8 la app saltaba a
"Semana 2" con 2 de 4 hechas y le aplicaba el `WeekOverride` de la semana
siguiente a media rotación. Su expectativa —y ahora el modelo— es que la
semana es el agrupador de las 4 sesiones, no una medida de tiempo.

El nuevo `WeekCycle` guarda un ciclo abierto por bloque (`cerradaEn` null).
La Semana N dura hasta completar cada `SessionTemplate` una vez. La migración
hace backfill del ciclo 1 desde `block.fechaInicio`: crearlo en `NOW()` habría
dejado fuera de la ventana lo ya entrenado, que era justo el bug a arreglar.

**"No se tachan los entrenamientos concluidos, parece caché."** No era caché.
`completedTemplateIds` se calculaba con `localDayBounds` — solo el día
calendario local, así que lo entrenado el lunes dejaba de verse completado el
martes. Ahora la ventana es `finalizadaEn >= cycle.iniciadaEn`. Aparte, `/hoy`
solo hacía fetch al montar: se agregó refetch en `visibilitychange` y `online`,
porque el badge depende de `SetLog`s que llegan por el outbox y podían no haber
drenado todavía al aterrizar en la pantalla.

**Se podían reiniciar sesiones ya hechas.** No había guarda en ningún lado.
Ahora `/hoy/[sessionTemplateId]` lee `completedTemplateIds` (la API ya lo
devolvía, la página nunca lo leía), deshabilita INICIAR y corta también dentro
de `handleIniciar` — el botón deshabilitado es la señal, no el mecanismo. Queda
un "Repetirla de todos modos" explícito. Y `siguienteEnCiclo` reemplaza a la
rotación global para elegir la sugerida, que antes podía apuntar a una sesión
ya completada.

**Descartar el entrenamiento en ejecución.** No existía: la única salida era
finalizar, o esperar 6 h a que `SessionRecoveryGate` la marcara `ABANDONADA`.
Es borrado real (`DELETE /api/sessions/[id]`, `SetLog` por cascada) más
limpieza de los seis stores de IndexedDB en una transacción, siguiendo el
patrón atómico de `saveSessionLog`. El `DELETE` entra al final del outbox y
`drain.ts` drena en orden de `seq`, así que gana sobre cualquier `PUT`
pendiente de la misma sesión. Hubo que enseñarle el verbo al beacon: su rama
de sesión hacía `upsertSessionLog` sin mirar el método, así que un lote con
`[PUT sesión, PUT series, DELETE sesión]` reconstruía lo recién descartado y
se tragaba el `DELETE` al fallar con body null.

**Celebración de fin de semana.** Overlay a pantalla completa con fuegos
artificiales en `<canvas>` (sin librería de animación — el proyecto no tiene
ninguna) y un mensaje de Grok (`grok-4.5`, endpoint compatible con OpenAI, sin
SDK) armado desde volumen por grupo muscular, PRs del ciclo, energía promedio y
delta de volumen contra la semana previa. El mensaje se cachea en el ciclo:
recargar Hoy no vuelve a llamar a la API ni cambia el texto ya visto. Sin
`XAI_API_KEY` o si Grok falla, cae a un mensaje determinista con las mismas
cifras — la fiesta nunca depende de un servicio externo. `prefers-reduced-motion`
se consulta con `matchMedia` porque el kill-switch de `globals.css` es CSS y no
alcanza a un canvas.

**La semana no avanza sola.** El overlay no se descarta tocando fuera: cerrar
la semana es un paso explícito, y entrega un resumen en Markdown copiable
(sesiones, volumen por grupo, PRs, molestias) para pasárselo al coach y cargar
los `WeekOverride` de la siguiente antes de que arranque.

**Nombres largos truncados por la etiqueta de grupo muscular.** El nombre
llevaba `truncate` mientras la etiqueta era `shrink-0`, así que el nombre se
comía a sí mismo para dejarle lugar. Ahora envuelve y la etiqueta queda
anclada arriba a la derecha.

`weekNumberForDate` sobrevive solo como fallback del export markdown para
bloques sin ciclos; el número de semana de una sesión histórica se resuelve
por `resolveCycleForDate` para que coincida con el que el atleta vio al
entrenarla.
