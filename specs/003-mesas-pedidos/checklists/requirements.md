# Specification Quality Checklist: Mesas y pedidos (Módulo 2)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- Validación 1 (2026-10-28): todo pasa salvo "No [NEEDS CLARIFICATION] markers remain". Quedan
  3 marcas a propósito, para resolverse con `/speckit-clarify`:
  - FR-004: si se registra el número de comensales al abrir la mesa, y si es obligatorio.
  - FR-005: si un mozo puede atender una mesa que abrió otro, y quién recibe entonces los avisos
    de plato listo.
  - FR-034: si se pueden agregar ítems a una mesa por cobrar, y en qué estado queda la mesa.
- Los supuestos de la descripción (aviso solo al mozo que abrió la mesa, anulación solo de
  ítems pendientes o en preparación, anulación desde la sesión del administrador) están en
  Assumptions como valores por defecto, para confirmarlos en la clarificación.
- No se mencionan tecnologías ni el contrato con Cocina: los requisitos de "sin recargar" y "al
  instante" se expresan como resultados visibles con tiempos en SC-003 y SC-004.
- Los escenarios de aceptación tienen identificadores `AC-<historia>.<n>` para la trazabilidad
  de pruebas que exige el Principio II de la constitución. Los requisitos sin escenario numerado
  propio (FR-023, FR-025, FR-037, FR-039 a FR-041) se verifican con su identificador FR y con los
  casos borde.
