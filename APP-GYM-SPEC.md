# SPEC — APP DE ENTRENAMIENTO

> Documento de requerimientos para el agente de desarrollo.
> **Stack:** libre (asumido Next.js + PostgreSQL). Este documento define **qué debe hacer y cómo debe comportarse**, no cómo implementarlo.
> **Versión:** 1.0 — 2026-07-30

---

## 1. Propósito

Una app web para **planear, ejecutar y analizar** entrenamiento de fuerza, con dos tipos de usuario:

- **Atleta** — ejecuta la rutina en el gimnasio, desde el teléfono, con el pulgar, sudando y a veces sin señal.
- **Coach** — diseña bloques, revisa el desempeño y ajusta.

**El caso de uso crítico es el atleta a mitad de una serie.** Todo lo demás es secundario. Si la experiencia de registrar una serie no es instantánea y a prueba de fallos, la app no sirve, por completo que sea el resto.

**Principio rector de todo el documento: perder datos de una sesión es un fallo crítico, no un bug menor.** Una serie que se pierde no se puede reconstruir de memoria, y sin el dato se rompe el cálculo de progresión de la siguiente sesión.

---

## 2. Roles y permisos

| Rol | Puede |
|---|---|
| **Atleta** | Ver y ejecutar sus rutinas; registrar series, métricas y notas; ver su historial y PRs; invitar a un coach |
| **Coach** | Todo lo del atleta sobre sí mismo + ver datos de sus atletas vinculados, crear/editar sus bloques, comentar sesiones |
| **Admin** | Gestión de usuarios y biblioteca global de ejercicios |

**Reglas de acceso:**

- Un coach solo ve atletas con vínculo **aceptado por el atleta**. El vínculo se crea por invitación (código o correo) y el atleta puede revocarlo en cualquier momento.
- Un atleta puede tener 0 o 1 coach activo. Un coach, N atletas.
- **Aislamiento estricto:** toda consulta filtra por propiedad del dato. Ninguna ruta debe permitir leer datos de otro usuario cambiando un ID en la URL. Verificar la autorización en el servidor en cada petición, nunca solo en la UI.
- El atleta siempre puede exportar y borrar todos sus datos.

---

## 3. Modelo de datos

### Usuarios y vínculos

```
User
  id, email, nombre, rol (atleta|coach|admin), zona_horaria,
  unidad_peso (kg|lb), creado_en

CoachAthleteLink
  id, coach_id, atleta_id, estado (pendiente|activo|revocado),
  invitado_en, aceptado_en, revocado_en
```

### Catálogo de ejercicios

```
Exercise
  id, nombre, alias[], grupo_muscular_primario,
  grupos_secundarios[], patron_movimiento
    (empuje_horizontal | empuje_vertical | jalon_horizontal |
     jalon_vertical | dominante_rodilla | dominante_cadera |
     aislamiento | core | correctivo),
  equipo (barra|mancuerna|polea|maquina|peso_corporal|banda),
  unilateral (bool), incremento_minimo_kg (default 2.5),
  es_global (bool), creado_por_user_id (null si es global),
  instrucciones, video_url (opcional)
```

> Biblioteca global precargada + ejercicios propios por usuario. Los alias importan: buscar "press banca" debe encontrar "press de banca con barra".

### Planeación

```
Block                          -- mesociclo
  id, atleta_id, creado_por_user_id, nombre,
  fecha_inicio, fecha_fin, estado (borrador|activo|completado|archivado),
  notas, criterios_progresion (json)

SessionTemplate                -- la sesión A, B, C, D
  id, block_id, clave ('A'), nombre ('Upper'), orden,
  notas, duracion_estimada_min

TemplateExercise
  id, session_template_id, exercise_id, orden,
  series_objetivo, reps_min, reps_max, rir_objetivo,
  descanso_seg, notas,
  agrupacion (null | 'superserie_1' | 'circuito_1'),
  es_opcional (bool), condicion (texto libre:
    "solo a partir de la semana 3 si no hubo molestia")

WeekOverride                   -- progresión semanal del bloque
  id, block_id, numero_semana,
  delta_series (int), rir_objetivo (override), nota
```

### Calendario

```
ScheduledSession
  id, atleta_id, block_id, session_template_id,
  fecha_programada, numero_semana,
  estado (pendiente|en_progreso|completada|omitida|reprogramada)
```

> **Las sesiones son intercambiables, no rígidas por día.** El calendario propone, no impone. El atleta debe poder arrastrar una sesión a otro día, o simplemente entrar y elegir "hoy hago la B" sin pelearse con la app. Cuando ejecuta una sesión en un día distinto al programado, la app reasigna en silencio — sin diálogos de confirmación ni marcar nada como "fallado".

### Ejecución (el corazón)

```
SessionLog
  id (UUID generado en el cliente),
  atleta_id, scheduled_session_id (nullable),
  session_template_id (nullable — permite sesión libre),
  iniciada_en, finalizada_en, estado (en_progreso|completada|abandonada),
  duracion_activa_seg,          -- excluye pausas
  energia_1a5, sueño_horas_previas, peso_corporal_kg (opcional),
  notas, sincronizada_en

SetLog
  id (UUID generado en el cliente),
  session_log_id, exercise_id, numero_serie,
  peso_kg, reps, rir,
  tipo (trabajo|calentamiento|dropset|fallo),
  completada_en (timestamp absoluto del cliente),
  descanso_real_seg,            -- medido, no prescrito
  notas,
  molestia_flag (bool),
  molestia_zona, molestia_nivel_1a10,
  es_pr (bool, calculado en servidor),
  version (int, para reconciliación)

ExerciseTargetCache             -- "Objetivo hoy", precalculado
  atleta_id, exercise_id, calculado_en,
  ultimo_desempeño (json), objetivo_sugerido (texto),
  peso_sugerido_kg, reps_sugeridas, racha_estancamiento (int)
```

### Análisis

```
PersonalRecord
  id, atleta_id, exercise_id, tipo (peso_max|reps_a_peso|e1rm|volumen),
  valor, peso_kg, reps, set_log_id, logrado_en, pr_anterior_valor

BodyMetric
  id, atleta_id, fecha, peso_kg, grasa_pct, grasa_visceral,
  masa_muscular_kg, cintura_cm, pecho_cm, brazo_d_cm, muslo_d_cm,
  cuello_cm, cadera_cm, fuente (manual|omron_csv|api)

CoachComment
  id, autor_user_id, atleta_id,
  ambito (sesion|ejercicio|bloque|general),
  session_log_id | exercise_id | block_id,
  texto, creado_en, leido_en
```

---

## 4. Pantallas

### 4.1 Hoy (pantalla de inicio)

Lo primero que ve el atleta. Debe responder en menos de un segundo: **¿qué hago hoy?**

- Tarjeta grande con la sesión de hoy: clave, nombre, número de ejercicios, duración estimada.
- Botón primario enorme: **EMPEZAR** (o **CONTINUAR** si hay sesión en progreso).
- Semana X de Y del bloque · foco de la semana.
- Peso de hoy: si no se ha registrado, un input inline de un solo toque.
- Chips secundarios: cambiar a otra sesión · sesión libre · ver calendario.
- Si hay comentarios del coach sin leer, banner arriba.

> **Si existe una sesión en progreso, la app abre directamente en el ejecutor.** No en "Hoy". Nadie que dejó una sesión a medias quiere ver un dashboard.

### 4.2 Calendario

- Vista mensual y semanal. En móvil, la semanal es la predeterminada.
- Cada día muestra su sesión con estado por color: completada, en progreso, pendiente, omitida.
- Tocar un día pasado abre el log de esa sesión en modo lectura.
- Arrastrar para reprogramar (con equivalente accesible: menú "mover a...").
- Métricas superpuestas opcionales: peso corporal como línea de fondo.

### 4.3 Bloques y rutinas (planeación)

- Lista de bloques: activo arriba, historial abajo.
- Editor de bloque: nombre, fechas, sesiones A/B/C/D, progresión semanal.
- Editor de sesión: tabla de ejercicios con arrastrar para reordenar, y por ejercicio series / rango de reps / RIR / descanso / notas.
- **Duplicar bloque** — la operación más usada al crear el siguiente mesociclo. Debe estar a un toque.
- Vista previa "cómo lo verá el atleta".
- Importar/exportar bloque como JSON o markdown (para pegar un plan generado fuera de la app).

### 4.4 Ejecutor de sesión ← **la pantalla crítica**

Diseño **una-mano, pulgar, pantalla vertical, en movimiento**. Controles grandes. Sin menús anidados. Sin scroll horizontal.

**Estructura:**

- **Encabezado fijo:** nombre de la sesión · cronómetro total · botón de pausa · progreso (ejercicio 3 de 7).
- **Cuerpo:** el ejercicio actual ocupa la pantalla. Los demás, colapsados arriba y abajo.
- **Por ejercicio se muestra:**
  - Nombre y notas de técnica
  - **Objetivo hoy** en grande — ej. *"70 kg × 8, o 72.5 × 6"*
  - Desempeño de la sesión anterior, siempre visible, sin tener que buscarlo
  - Filas de series: `[ peso ] × [ reps ] @ RIR [ n ]` con botón ✓
- **Registro de una serie:**
  - Peso y reps con steppers `+/−` (incremento configurable por ejercicio) **y** entrada directa por teclado numérico
  - Prellenado con el valor de la serie anterior del mismo ejercicio — casi siempre correcto, y evita teclear
  - RIR con selector de chips (0-1-2-3-4)
  - Un toque en ✓ confirma la serie **y arranca el temporizador de descanso**
  - **Deshacer** visible durante 10 segundos tras confirmar

**Temporizador de descanso:**

- Arranca automáticamente al confirmar una serie, con el valor prescrito del ejercicio.
- Ajustable en vivo: `−15s` / `+15s` / reiniciar / saltar.
- Cuenta regresiva grande, visible desde lejos (se deja el teléfono en la banca).
- Al llegar a cero: **vibración + sonido + notificación del sistema**, en ese orden de prioridad. Debe funcionar con la pantalla apagada o el navegador en segundo plano.
- Registra también el **descanso real** (tiempo entre confirmación de una serie y la siguiente), no solo el prescrito. Ese dato importa para el análisis.
- Ver §5 para los requisitos de exactitud — es donde casi todas las apps web fallan.

**Registro de molestia:**

Botón permanente y accesible por ejercicio: **"Reportar molestia"**. Abre zona + nivel 1-10 + nota. Marca la serie y **notifica al coach**. Dado el antecedente de tendinitis de hombro, esto no es una función secundaria: es un requisito de seguridad y debe estar a un toque desde el ejecutor.

**Cierre de sesión:**

Resumen automático: duración, volumen total (kg × reps), series completadas vs. planeadas, PRs detectados, comparación contra la sesión anterior. Campos de energía 1-5 y nota libre. Botón de finalizar.

**Otras capacidades del ejecutor:**

- Saltar o reordenar ejercicios sobre la marcha (el gym está lleno y la máquina está ocupada — pasa siempre)
- Sustituir un ejercicio por otro sin salir de la sesión, conservando el registro
- Agregar un ejercicio no planeado
- Agregar una serie extra o eliminar una planeada
- Marcar series de calentamiento (**no cuentan** para volumen ni PRs)
- Notas por serie
- **Mantener la pantalla encendida** durante toda la sesión (Wake Lock, con reactivación al volver de segundo plano)

### 4.5 Historial y progreso

- Lista de sesiones con filtro por ejercicio, bloque y rango de fechas.
- **Vista por ejercicio:** gráfica de peso, reps, e1RM estimado y volumen a lo largo del tiempo. Es la pantalla que más se consulta después del ejecutor.
- Volumen semanal por grupo muscular (series efectivas, excluyendo calentamiento).
- Feed de PRs.
- Indicadores de estancamiento: ejercicios sin progreso en 3+ sesiones, marcados.

### 4.6 Métricas corporales

- Registro de peso con **promedio móvil de 7 días** graficado sobre los datos crudos. **El promedio es la línea protagonista; los puntos diarios van tenues al fondo.** Esta jerarquía visual no es estética, es pedagógica: evita reaccionar al ruido diario.
- Medidas corporales, cada 15 días.
- Importación de CSV de báscula Omron (formato conocido: `Fecha de la medición, Huso horario, Peso(kg), Grasa corporal(%), Grasa visceral, Metabolismo en reposo(Kcal), Músculo esquelético(%), IMC`).
- Fotos de progreso con fecha (privadas, nunca expuestas en ninguna API ni export).

### 4.7 Vista de coach

- Lista de atletas con semáforo: entrenó esta semana, adherencia, alertas.
- **Alertas automáticas, ordenadas por prioridad:**
  1. Molestia o dolor reportado ← siempre primero
  2. Rendimiento a la baja en 2+ sesiones consecutivas
  3. Ejercicio estancado 3+ sesiones
  4. Sin entrenar en 7+ días
  5. Sin registrar peso en 5+ días
- Detalle del atleta: bloque activo, últimas sesiones, gráficas por ejercicio, métricas.
- Comentar una sesión, un ejercicio o el bloque.
- Editar el bloque del atleta y publicar cambios.

---

## 5. Durabilidad de datos — requisitos no negociables

Esta sección es la razón de ser del documento. El navegador móvil es un entorno hostil: el sistema operativo suspende pestañas sin avisar, el usuario recarga por error, la señal se cae, la batería se acaba.

### 5.1 Local primero, siempre

- **Cada interacción se escribe en almacenamiento local ANTES de tocar la red.** No existe un botón "guardar sesión". Confirmar una serie = escritura local inmediata y confirmada.
- Usar **IndexedDB** como almacén principal de la sesión activa (localStorage no alcanza en volumen ni es transaccional).
- La UI refleja el estado local, no el del servidor. La red es una tarea de fondo que nunca bloquea al usuario ni muestra spinners en el flujo de registro.

### 5.2 IDs generados en el cliente

Todo `SessionLog` y `SetLog` nace con un **UUID v4 generado en el cliente**. Esto permite crear registros sin conexión y hace que la sincronización sea **idempotente**: si el mismo evento se envía dos veces, el servidor lo reconoce y no duplica.

### 5.3 Bandeja de salida (outbox)

- Cada mutación se encola como evento: `{id, tipo, payload, timestamp_cliente, intentos}`.
- Un worker vacía la cola cuando hay conexión, con reintentos y retroceso exponencial.
- El servidor ingiere de forma idempotente por ID de evento.
- La UI muestra un indicador discreto de estado: sincronizado ✓ / N cambios pendientes. **Nunca alarmista** — estar sin sincronizar es un estado normal, no un error.

### 5.4 Recuperación de sesión

- Al cargar la app, si existe una sesión con estado `en_progreso`, **se abre directamente en ella**, con todas las series ya registradas y el cronómetro correcto.
- Recargar la página a mitad de una serie no debe costar ni un dato.
- Escuchar `visibilitychange` y `pagehide` para forzar el vaciado de la cola. **No usar `beforeunload`** como única garantía: en móvil no dispara de forma confiable.
- Si una sesión lleva más de 6 horas en progreso, al reabrirla preguntar: *"¿Sigues entrenando o la cerramos?"* — nunca descartarla en automático.

### 5.5 Exactitud de los temporizadores

**El error más común en apps web, y el que más molesta en la práctica.**

- **Nunca acumular tiempo con `setInterval`.** Los navegadores móviles limitan o congelan los temporizadores en segundo plano; un contador acumulado se atrasa minutos.
- Guardar el **timestamp absoluto de inicio** (`Date.now()`) y calcular el tiempo transcurrido como `ahora − inicio` en cada repintado. Así, si la pestaña estuvo congelada 3 minutos, al volver el número es correcto.
- Persistir el timestamp de inicio del descanso en IndexedDB. Si la app se recarga durante el descanso, el temporizador retoma exacto.
- Para la alarma al terminar el descanso: programar una **notificación desde el service worker**, que no depende de que la pestaña esté viva. El sonido y la vibración en la pestaña son el complemento, no el mecanismo principal.
- El cronómetro total de la sesión se calcula igual: desde `iniciada_en`, descontando las pausas explícitas.

### 5.6 PWA y offline

- Instalable, con ícono y a pantalla completa.
- Service worker que precachea el shell y las rutas de ejecución.
- **La sesión completa debe poder ejecutarse sin conexión**, incluidos el catálogo de ejercicios, la rutina del día y los objetivos precalculados. Esto obliga a sincronizar el bloque activo al dispositivo por anticipado.
- Background Sync donde exista; respaldo con vaciado al recuperar el foco.

### 5.7 Resolución de conflictos

- Los `SetLog` son **append-only** con ID estable: los conflictos reales son raros.
- Ante edición del mismo registro desde dos dispositivos: gana el `timestamp_cliente` más reciente, conservando la versión anterior en un log de auditoría.
- El coach **nunca** edita registros históricos del atleta. Solo comenta. Los datos ejecutados son inmutables para terceros.

### 5.8 Criterios de aceptación (probar explícitamente)

Ninguna de estas pruebas puede perder un solo dato:

1. Registrar 3 series → matar la pestaña → reabrir → las 3 series están y la sesión sigue en progreso.
2. Poner el teléfono en modo avión → completar la sesión entera → reconectar → todo sincroniza sin duplicados.
3. Iniciar un descanso de 3 min → bloquear la pantalla 5 min → desbloquear → el temporizador muestra que terminó y la notificación llegó.
4. Registrar la misma serie desde dos dispositivos con el mismo ID → el servidor guarda una.
5. Recargar la página a mitad de la escritura de peso/reps → el último valor confirmado permanece.
6. Sesión de 90 minutos con la pantalla suspendida varias veces → el cronómetro total es exacto contra el reloj real.

---

## 6. Lógica automática

### 6.1 "Objetivo hoy" — doble progresión

Para cada ejercicio, calcular antes de la sesión a partir del último desempeño registrado:

```
si (todas las series de trabajo alcanzaron reps_max con rir <= rir_objetivo):
    peso_sugerido = ultimo_peso × 1.05  (redondeado al incremento del ejercicio)
    reps_sugeridas = reps_min
    texto = "Sube a {peso} kg × {reps_min}"
sino:
    peso_sugerido = ultimo_peso
    reps_sugeridas = mejor_reps_previa + 1
    texto = "{peso} kg × {reps} (una más que la vez pasada)"

si no hay registro previo:
    texto = "Sesión de calibración — busca terminar con RIR {rir_objetivo}"
```

Mostrar siempre junto al desempeño anterior. **La app dice qué hay que superar; el atleta no debe tener que calcularlo ni recordarlo.**

### 6.2 Detección de PRs

Al cerrar la sesión, evaluar por ejercicio (ignorando calentamientos):

- **Peso máximo** movido a cualquier número de reps
- **Reps máximas** a un peso dado
- **e1RM estimado** (Epley: `peso × (1 + reps/30)`) — el más útil para comparar entre rangos de reps
- **Volumen máximo** en una sesión (Σ peso × reps)

Mostrar el PR en el resumen de cierre, guardarlo y notificar al coach.

> Marcar los e1RM calculados con más de 12 reps como estimaciones de baja confianza: la fórmula pierde precisión en rangos altos.

### 6.3 Banderas de análisis

- **Estancamiento:** 3 sesiones consecutivas sin mejorar peso ni reps en un ejercicio.
- **Regresión:** 2 sesiones consecutivas con desempeño a la baja. Sugerir revisar sueño, calorías y fatiga **antes** de tocar el programa.
- **Molestia recurrente:** mismo `molestia_zona` reportada 2+ veces en 14 días → alerta prioritaria al coach.
- **Adherencia:** sesiones completadas / programadas, por semana.

### 6.4 Volumen semanal

Series efectivas por grupo muscular y semana (excluyendo calentamiento; los secundarios cuentan como 0.5). Comparar contra los rangos de referencia: mantenimiento 6-10, hipertrofia 10-20, grupo rezagado 15-22.

---

## 7. Integraciones de salida

### 7.1 API de solo lectura (para el agente coach)

Autenticación por **token de solo lectura**, generado por el atleta, revocable, con alcance por atleta.

```
GET /api/v1/export/sessions?desde=&hasta=
GET /api/v1/export/exercise/:id/history
GET /api/v1/export/metrics?desde=&hasta=
GET /api/v1/export/prs
GET /api/v1/export/summary?semana=          ← el más importante
```

`summary` devuelve, en un solo objeto: sesiones de la semana con todas las series, PRs, adherencia, volumen por grupo muscular, banderas activas, métricas corporales con promedio móvil, y molestias reportadas. **Debe ser suficiente para un check-in semanal sin hacer más peticiones.**

Reglas: JSON estable y versionado · fechas en ISO 8601 con zona horaria · pesos siempre en kg (la conversión es solo de presentación) · **nunca** incluir fotos ni datos de otros usuarios.

### 7.2 Export a markdown

Botón "Exportar" que genera markdown listo para el hub de archivos, en dos formatos:

**Log de sesión** (para `02-LOG-ENTRENAMIENTO.md`):

```markdown
## 2026-07-31 — SESIÓN A · UPPER
Duración: 62 min | Energía: 4/5 | Sueño previo: 7 h

| Ejercicio | S1 | S2 | S3 | RIR | Notas |
|-----------|----|----|----|-----|-------|
| Press mancuernas neutro | 20×12 | 20×11 | 20×10 | 3 | Hombro sin molestia |

PRs: ninguno (sesión de calibración)
Siguiente sesión: 22.5 kg × 10-12
```

**Resumen semanal** (para `06-CHECKINS.md`): tabla de métricas con tendencia, sesiones completadas, PRs, banderas.

Disponible como descarga y como endpoint `GET /api/v1/export/markdown?tipo=&semana=`.

### 7.3 Importación

- CSV de báscula Omron (columnas ya especificadas en §4.6)
- Bloque de entrenamiento desde JSON o markdown, para pegar un plan generado fuera de la app

---

## 8. Diseño de interfaz

**Prioridades, en orden:**

1. **Móvil primero.** El escritorio es para planear; el teléfono es para entrenar. Si hay que sacrificar algo, se sacrifica el escritorio.
2. **Pulgar, una mano.** Controles primarios en el tercio inferior de la pantalla. Nada crítico en las esquinas superiores.
3. **Legible de lejos y con prisa.** El teléfono va a estar en una banca a un metro. Números grandes, contraste alto.
4. **Modo oscuro por defecto.** Los gimnasios tienen iluminación irregular y muchos entrenan de noche.
5. **Cero fricción en el registro.** Confirmar una serie = un toque. Todo lo demás puede costar más.
6. **Sin diálogos modales durante la ejecución.** Nada debe interrumpir. Las confirmaciones se resuelven con "deshacer", no con "¿estás seguro?".
7. **Estados vacíos que enseñan.** La primera vez que se abre un ejercicio sin historial, explicar qué es RIR y cómo elegir el peso, en una línea.

**Accesibilidad:** objetivos táctiles de 44×44 px mínimo · contraste AA · funciona con teclado · lectores de pantalla en los flujos principales · **nunca** comunicar estado solo con color (el semáforo del calendario necesita también forma o texto).

---

## 9. Fuera de alcance (v1)

Explícitamente **no** construir todavía. Anotarlo evita que el alcance se desborde:

- Registro de nutrición (va en app separada — ver spec correspondiente)
- Videos o análisis de técnica
- Funciones sociales, feed, retos
- Wearables e integración con Apple Health / Google Fit
- Pagos y suscripciones
- App nativa
- IA generadora de rutinas dentro de la app

---

## 10. Orden de construcción sugerido

| Fase | Entregable |
|---|---|
| **1** | Modelo de datos + auth + roles. Crear bloque y sesiones a mano. |
| **2** | **Ejecutor de sesión con durabilidad completa.** Nada más se construye hasta que las 6 pruebas de §5.8 pasan. |
| **3** | Temporizador de descanso con exactitud en segundo plano + notificaciones + Wake Lock. |
| **4** | PWA, service worker, offline total, outbox y sincronización. |
| **5** | Calendario, historial, gráficas por ejercicio, PRs. |
| **6** | Métricas corporales + importación de CSV Omron. |
| **7** | Vista de coach, vínculos, comentarios, alertas. |
| **8** | API de export, tokens, export a markdown. |

**La fase 2 es el proyecto.** Si el ejecutor no es impecable, ninguna de las demás fases importa. Conviene usar la app en el gimnasio en cuanto la fase 3 esté lista, aunque falte todo lo demás — el uso real revela en una sesión lo que no se ve en el escritorio.

---

## 11. Datos de siembra

Precargar el bloque vigente para poder probar de inmediato. Fuente: `01-PLAN-ENTRENAMIENTO.md`.

**Bloque 1 — Reintroducción y base** · 2026-07-31 a 2026-08-27 · 4 semanas
Progresión por semana: S1 RIR 3-4 · S2 RIR 2-3 · S3 RIR 1-2 (+1 serie en compuestos) · S4 RIR 1-2

**Sesión A — Upper**

| Ejercicio | Series | Reps | RIR | Descanso |
|---|---|---|---|---|
| Rotación externa con banda | 2 | 15 | — | 45 s |
| Press mancuernas agarre neutro | 3 | 10-12 | 3 | 120 s |
| Remo sentado en polea, agarre neutro | 3 | 10-12 | 3 | 120 s |
| Jalón al pecho, agarre neutro | 3 | 10-12 | 3 | 120 s |
| Face pull en polea | 3 | 15 | 2 | 60 s |
| Elevaciones laterales | 2 | 15 | 2 | 60 s |
| Curl bíceps con mancuernas | 2 | 12 | 1 | 60 s |
| Extensión de tríceps con cuerda | 2 | 12-15 | 1 | 60 s |

**Sesión B — Lower**

| Ejercicio | Series | Reps | RIR | Descanso |
|---|---|---|---|---|
| Prensa de piernas | 3 | 12-15 | 3 | 120 s |
| Peso muerto rumano con mancuernas | 3 | 10-12 | 3 | 120 s |
| Zancada búlgara | 2 | 12 c/pierna | 2 | 90 s |
| Curl femoral en máquina | 3 | 12-15 | 2 | 60 s |
| Extensión de cuádriceps | 2 | 15 | 1 | 60 s |
| Elevación de talones | 3 | 15-20 | 1 | 45 s |
| Plancha frontal | 3 | 30-45 s | — | 45 s |

**Sesión C — Upper (variante)**

| Ejercicio | Series | Reps | RIR | Descanso |
|---|---|---|---|---|
| Rotación externa con banda | 2 | 15 | — | 45 s |
| Press inclinado mancuernas neutro | 3 | 10-12 | 3 | 120 s |
| Remo con mancuerna a una mano | 3 | 12 c/lado | 3 | 90 s |
| Jalón al pecho o dominada asistida | 3 | 10-12 | 3 | 120 s |
| Press hombro mancuernas neutro | 3 | 12-15 | 3 | 90 s |
| Face pull en polea | 3 | 15 | 2 | 60 s |
| Curl martillo | 2 | 12 | 1 | 60 s |
| Extensión de tríceps sobre la cabeza | 2 | 12-15 | 1 | 60 s |

> El press de hombro lleva condición: *"solo a partir de la semana 3 y si no hubo molestia en el hombro"*. Es el caso de prueba del campo `condicion` en `TemplateExercise`.

**Sesión D — Lower (variante)**

| Ejercicio | Series | Reps | RIR | Descanso |
|---|---|---|---|---|
| Sentadilla goblet o hack | 3 | 12-15 | 3 | 120 s |
| Hip thrust | 3 | 12-15 | 2 | 90 s |
| Peso muerto rumano con barra | 3 | 10-12 | 3 | 120 s |
| Prensa a una pierna o step-up | 2 | 12 c/pierna | 2 | 90 s |
| Curl femoral sentado | 3 | 12-15 | 2 | 60 s |
| Elevación de talones sentado | 3 | 15-20 | 1 | 45 s |
| Crunch en polea o rueda abdominal | 3 | 12-15 | 1 | 60 s |

Sembrar también las **75 mediciones históricas** del CSV Omron (ene–jul 2026) para que las gráficas de métricas tengan datos reales desde el primer arranque.
