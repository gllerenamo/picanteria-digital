# Picantería Digital Constitution

## Core Principles

### I. TypeScript estricto de extremo a extremo

Todo el código del proyecto (frontend, backend, scripts y pruebas) MUST estar escrito en
TypeScript con el modo estricto activado.

- `tsconfig.json` MUST declarar `"strict": true` en todos los paquetes; ninguna feature puede
  desactivar opciones estrictas (`strictNullChecks`, `noImplicitAny`, etc.).
- El uso de `any` explícito, `@ts-ignore` y `@ts-nocheck` está prohibido. Si es inevitable,
  MUST usarse `@ts-expect-error` con un comentario que explique el motivo, y la revisión de
  código MUST aprobarlo de forma explícita.
- Los contratos entre frontend y backend (DTOs, respuestas de la API) MUST estar tipados.
  Los datos externos (cuerpo de peticiones, variables de entorno) MUST validarse en tiempo de
  ejecución antes de usarse.
- La compilación (`tsc --noEmit` o equivalente) MUST terminar sin errores para integrar código.

**Razón**: el tipado estricto detecta errores antes de ejecutar y hace explícitos los
contratos entre la interfaz del mozo, la cocina y el servidor.

### II. Pruebas de criterios de aceptación (NO NEGOCIABLE)

Cada feature MUST tener pruebas automatizadas que verifiquen todos sus criterios de
aceptación definidos en `spec.md`.

- Cada criterio de aceptación MUST tener al menos una prueba automatizada que lo cubra, y
  la prueba MUST referenciar el identificador del criterio (por ejemplo, en su nombre o
  descripción) para que la trazabilidad sea verificable.
- Las pruebas de criterios de aceptación MUST ejercitar el comportamiento observable por el
  usuario o por el consumidor de la API, no detalles internos de implementación.
- Una feature no se considera terminada si algún criterio de aceptación carece de prueba o si
  alguna prueba falla.
- Los errores corregidos SHOULD incorporar una prueba de regresión que reproduzca el fallo.

**Razón**: los criterios de aceptación son la definición de "terminado"; sin pruebas
automatizadas no hay evidencia de que la feature cumple lo especificado.

### III. Interfaz en español

Todo texto visible para el usuario final MUST estar en español.

- Etiquetas, botones, mensajes de error, validaciones, notificaciones y estados vacíos MUST
  estar en español, incluidos los mensajes de error que la API devuelve para mostrarse en
  pantalla.
- Montos, fechas y horas MUST mostrarse con convenciones locales de Perú (`es-PE`): moneda en
  soles (`S/`) y fechas en formato día/mes/año.
- Los textos MUST usar un vocabulario comprensible para el personal de la picantería (mozo,
  cocina, pedido, mesa, plato) y evitar jerga técnica.

**Razón**: el personal opera la aplicación durante el servicio; un texto en otro idioma o
técnico provoca errores en pedidos.

### IV. Optimización para tablet en vistas de mozo y cocina

Las vistas usadas por el mozo y por la cocina MUST estar diseñadas y verificadas para tablet
como dispositivo principal.

- Estas vistas MUST funcionar sin desplazamiento horizontal en anchos de 768 px a 1366 px,
  en orientación vertical y horizontal.
- Todo elemento interactivo MUST tener un área táctil mínima de 44×44 px y MUST NOT depender
  de `hover`, clic derecho o atajos de teclado para completar una tarea.
- La vista de cocina MUST ser legible a distancia de trabajo: el contenido de los pedidos
  SHOULD usar un tamaño de texto de al menos 18 px y un contraste que cumpla WCAG AA.
- Las tareas frecuentes del mozo (tomar y enviar un pedido) SHOULD completarse con el menor
  número de toques posible; toda acción destructiva MUST pedir confirmación.

**Razón**: mozo y cocina trabajan de pie, con prisa y con las manos ocupadas; una interfaz
pensada para escritorio ralentiza el servicio y genera errores.

## Stack tecnológico y restricciones

- **Frontend**: React con TypeScript estricto.
- **Backend**: NestJS con TypeScript estricto.
- **Base de datos**: PostgreSQL. Los cambios de esquema MUST hacerse mediante migraciones
  versionadas en el repositorio; está prohibido modificar el esquema a mano en un entorno.
- Incorporar otro lenguaje, framework principal o motor de base de datos requiere una
  enmienda a esta constitución.
- Las bibliotecas de apoyo (estado, formularios, ORM, framework de pruebas) se eligen en el
  `plan.md` de cada feature y MUST justificarse allí cuando sean nuevas en el proyecto.
- Las credenciales y secretos MUST NOT guardarse en el repositorio; se leen desde variables de
  entorno.

## Flujo de desarrollo y puertas de calidad

- Cada feature sigue el flujo de Spec Kit: especificación (`spec.md`) con criterios de
  aceptación identificables, plan (`plan.md`), tareas (`tasks.md`) e implementación.
- El `plan.md` de cada feature MUST incluir una verificación de cumplimiento de esta
  constitución y justificar por escrito cualquier excepción.
- Para integrar código a la rama principal MUST cumplirse:
  1. La compilación TypeScript termina sin errores (Principio I).
  2. Todas las pruebas pasan y cada criterio de aceptación tiene su prueba (Principio II).
  3. Los textos nuevos visibles para el usuario están en español (Principio III).
  4. Los cambios en vistas de mozo o cocina se verificaron en viewport de tablet en ambas
     orientaciones (Principio IV).
- La revisión de código MUST comprobar estas puertas antes de aprobar.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica o convención del proyecto. Ante
  un conflicto, manda la constitución.
- Las enmiendas MUST hacerse con `/speckit-constitution`, quedar registradas en el historial de
  Git con su justificación y actualizar la versión y la fecha de última enmienda.
- Versionado semántico de la constitución:
  - **MAJOR**: eliminación o redefinición incompatible de un principio o regla de gobierno.
  - **MINOR**: nuevo principio o sección, o ampliación sustancial de una guía existente.
  - **PATCH**: aclaraciones, redacción o correcciones sin cambio de significado.
- El cumplimiento se revisa en cada `plan.md` (verificación de constitución) y en cada
  revisión de código. Toda complejidad o excepción MUST justificarse por escrito.

**Version**: 1.0.0 | **Ratified**: 2026-10-28 | **Last Amended**: 2026-10-28
