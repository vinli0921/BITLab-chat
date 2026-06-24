/**
 * Canonical recursive JSON value for research-telemetry event payloads — the
 * single source of truth shared by the frontend queue (`client/src/lib/research`)
 * and the backend (`packages/data-schemas`, `packages/api`).
 *
 * The object case is expressed through the `ResearchPayloadObject` interface
 * rather than an inline `{ [key: string]: ... }` mapped type. This indirection
 * is deliberate: when the recursive type flows through Mongoose's
 * `Schema<IResearchEvent>` generic on the data-schemas side it would otherwise
 * trigger TS2589 (excessively deep type instantiation). The named interface
 * gives TypeScript a stable reference point and breaks the infinite expansion.
 * DO NOT collapse the interface back into an inline object type.
 */
export type ResearchPayloadValue =
  | string
  | number
  | boolean
  | null
  | ResearchPayloadValue[]
  | ResearchPayloadObject;

export interface ResearchPayloadObject {
  [key: string]: ResearchPayloadValue;
}

/** Top-level research-event payload: an object map of payload values. */
export type ResearchPayload = ResearchPayloadObject;
