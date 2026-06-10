// Domain types for the eng-pack UI. Mirrors the .fuse entity and workflow
// shapes in ../../entities and ../../workflows.
//
// Substrate gap (M741 + M539): the BFF projector that will officially
// shape these isn't fully wired yet. These types hand-mirror what the
// projector will eventually produce so screens can be designed against
// the right shape now and swapped to real BFF data when M539+M540 land.

export type ActorRole =
  | "techlead"
  | "researcher"
  | "strategist"
  | "architect"
  | "dev"
  | "qa"
  | "auditor"
  | "decider"
  | "approver"
  | "qa-owner"

export type ActorKind = "agent" | "human"

export interface Actor {
  actor_id: string
  role: ActorRole
  display_name: string
  kind: ActorKind
  status?: string
}

// One event observed on a conversation's event log. Trigger events come
// from external actors; outcome events come back from submachines.
export interface ConversationEvent {
  index: number
  name: string
  payload: Record<string, unknown>
  source: "actor" | "outcome"
  actor_id?: string         // for source="actor"
  emitted_by_engagement?: string // for source="outcome"; the child workflow name
  at: string                // ISO timestamp
}

// The conversation = one running eng_feature workflow instance.
export interface Conversation {
  conversation_id: string
  workflow: string          // "eng_feature@1"
  subject: string
  originator_id: string
  techlead_id?: string
  current_state: string     // a state name from eng_feature.fuse
  started_at: string
  events: ConversationEvent[]
  // Foreign keys to the artifact entities the conversation has produced.
  research_artifact_ids: string[]
  strategy_decision_ids: string[]
  design_ids: string[]
  milestone_id?: string
  code_change_ids: string[]
  test_plan_ids: string[]
  test_run_ids: string[]
  defect_ids: string[]
  attestation_ids: string[]
}

// A single entity-row instance. The shape lines up with the @display
// annotations in entities/*.fuse; per-field metadata (label, group,
// readonly, format) lives in EntityFieldSpec and is consumed by the
// inspector renderer.
export interface EntityRow {
  entity_kind: EntityKind
  id: string
  state: string
  version: number
  data: Record<string, unknown>
}

export type EntityKind =
  | "Actor"
  | "ResearchArtifact"
  | "StrategyDecision"
  | "Design"
  | "Milestone"
  | "CodeChange"
  | "TestPlan"
  | "TestRun"
  | "DefectReport"
  | "Attestation"

// Per-field rendering hint, mirrored from @display annotations.
export interface EntityFieldSpec {
  name: string
  label: string
  group?: string
  format?:
    | "id"
    | "timestamp"
    | "currency"
    | "currency_code"
    | "machine_state"
  readonly?: boolean
  derived?: boolean
  sensitive?: boolean
  hint?: string
  nav?: { view: string; label: string }
}

export interface EntitySchema {
  kind: EntityKind
  title: string
  // Ordered list of fields that appear on the entity. Matches the
  // @order(...) annotation header in the .fuse entity file.
  fields: EntityFieldSpec[]
}
