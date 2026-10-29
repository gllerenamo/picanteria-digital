# Specification Quality Checklist: 002-carta

**Purpose**: Validation of specification quality before generating technical plan.
**Feature**: `specs/002-carta/spec.md`

## Quality Gates

- [x] **No implementation details**: Spec discusses users, dishes, categories, prices, and availability, without mentioning database queries, framework internals, or wire protocols.
- [x] **User scenarios with testable criteria**: Every user story contains concrete Given/When/Then scenarios with distinct criteria `AC-x.y`.
- [x] **Constitution adherence**:
  - [x] Spanish user-facing language (Principio III)
  - [x] Currency in soles (`S/`) and 2 decimal points
  - [x] Tablet viewport considerations (Principio IV)
  - [x] Traceable acceptance criteria IDs (Principio II)
- [x] **Integration alignment**:
  - [x] Availability toggle fulfills FR-009 & FR-020 of Mesas y Pedidos.
  - [x] Historical unit prices remain immutable (fulfills FR-025).
  - [x] DiningTable catalog initialized to unblock Mesas y Pedidos.
