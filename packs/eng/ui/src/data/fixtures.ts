// Fixture conversation for the eng-pack UI. Substitutes for real BFF
// projector data until fuse-bff M539 + fuse-local M741 land. Mirrors
// the events fired by the "happy path" test in
// ../../workflows/eng-feature.fuse — same actor ids, same event order,
// same payloads. Timestamps are synthesized.

import type { Actor, Conversation, EntityRow } from "../types"

export const actors: Actor[] = [
  { actor_id: "tl_alice", role: "techlead", display_name: "Alice (techlead)", kind: "agent", status: "available" },
  { actor_id: "rs_bob", role: "researcher", display_name: "Bob (researcher)", kind: "agent", status: "available" },
  { actor_id: "st_diana", role: "strategist", display_name: "Diana (strategist)", kind: "agent", status: "available" },
  { actor_id: "dc_eric", role: "decider", display_name: "Eric (decider)", kind: "human" },
  { actor_id: "ar_fran", role: "architect", display_name: "Fran (architect)", kind: "agent", status: "available" },
  { actor_id: "ap_greg", role: "approver", display_name: "Greg (approver)", kind: "human" },
  { actor_id: "dev_chris", role: "dev", display_name: "Chris (dev)", kind: "agent", status: "available" },
  { actor_id: "dev_hank", role: "dev", display_name: "Hank (dev reviewer)", kind: "agent", status: "available" },
  { actor_id: "qa_iris", role: "qa", display_name: "Iris (qa)", kind: "agent", status: "available" },
  { actor_id: "qo_jack", role: "qa-owner", display_name: "Jack (qa-owner)", kind: "human" },
  { actor_id: "au_kate", role: "auditor", display_name: "Kate (auditor)", kind: "agent", status: "available" },
]

// Each event below corresponds 1:1 to a `when` line in the
// "happy path" test in eng-feature.fuse, in order. Timestamps walk
// forward by ~3 minutes per event so the timeline shows real
// passage. The orchestrator fires phase triggers; submachine
// engagement outcomes (ResearchSynthesized, StrategyCommitted, ...)
// come back as outcome events the parent consumes.
export const conversation: Conversation = {
  conversation_id: "conv_m101",
  workflow: "eng_feature@1",
  subject: "ship M-101 conversation durability",
  originator_id: "tl_alice",
  techlead_id: "tl_alice",
  current_state: "SHIPPED",
  started_at: "2026-06-10T14:00:00Z",
  events: [
    { index: 0, name: "StartFeature", source: "actor", actor_id: "tl_alice", at: "2026-06-10T14:00:00Z",
      payload: { subject: "ship M-101 conversation durability", originator_id: "tl_alice", techlead_id: "tl_alice" } },
    { index: 1, name: "CommissionResearch", source: "actor", actor_id: "tl_alice", at: "2026-06-10T14:03:00Z",
      payload: { artifact_id: "ra_1", subject: "prior art on conversation durability", requester_id: "tl_alice", assignee_id: "rs_bob" } },
    { index: 2, name: "ResearchSynthesized", source: "outcome", emitted_by_engagement: "researcher_engagement", at: "2026-06-10T14:24:00Z",
      payload: { artifact_id: "ra_1", artifact_ref: "/docs/research/durability.md", citations: "RAFT;Calvin;FoundationDB", summary: "WAL-backed is mainstream" } },
    { index: 3, name: "FrameStrategy", source: "actor", actor_id: "tl_alice", at: "2026-06-10T14:27:00Z",
      payload: { decision_id: "sd_1", subject: "durability approach", options_ref: "/docs/strategy/durability-options.md", recommended_option: "WAL-backed", drafter_id: "st_diana" } },
    { index: 4, name: "StrategyCommitted", source: "outcome", emitted_by_engagement: "strategist_engagement", at: "2026-06-10T14:42:00Z",
      payload: { decision_id: "sd_1", chosen_option: "WAL-backed", commit_rationale: "matches existing infra", decider_id: "dc_eric" } },
    { index: 5, name: "DraftDesign", source: "actor", actor_id: "tl_alice", at: "2026-06-10T14:45:00Z",
      payload: { design_id: "d_1", subject: "WAL-backed durability", draft_ref: "/docs/design/durability.md", author_id: "ar_fran" } },
    { index: 6, name: "DesignApproved", source: "outcome", emitted_by_engagement: "architect_engagement", at: "2026-06-10T15:10:00Z",
      payload: { design_id: "d_1", approver_id: "ap_greg", approval_rationale: "tradeoffs documented; sound" } },
    { index: 7, name: "AcceptFeature", source: "actor", actor_id: "tl_alice", at: "2026-06-10T15:13:00Z",
      payload: { feature_subject: "WAL-backed durability impl", techlead_id: "tl_alice" } },
    { index: 8, name: "ProposeChange", source: "actor", actor_id: "tl_alice", at: "2026-06-10T15:16:00Z",
      payload: { change_id: "cc_1", subject: "wire WAL into engine", milestone_id: "M-101", diff_ref: "/pr/123", author_id: "dev_chris" } },
    { index: 9, name: "CodeChangeDeployed", source: "outcome", emitted_by_engagement: "dev_engagement", at: "2026-06-10T15:55:00Z",
      payload: { change_id: "cc_1", deployer_id: "dev_chris", deploy_ref: "build_42" } },
    { index: 10, name: "DraftTestPlan", source: "actor", actor_id: "tl_alice", at: "2026-06-10T15:58:00Z",
      payload: { plan_id: "tp_1", subject: "durability tests", milestone_id: "M-101", plan_ref: "/docs/tests/durability.md", author_id: "qa_iris" } },
    { index: 11, name: "TestPlanReady", source: "outcome", emitted_by_engagement: "qa_engagement", at: "2026-06-10T16:14:00Z",
      payload: { plan_id: "tp_1" } },
    { index: 12, name: "RequestAttestation", source: "actor", actor_id: "tl_alice", at: "2026-06-10T16:17:00Z",
      payload: { attestation_id: "at_1", target_kind: "code-change", target_ref: "cc_1", policy_ref: "/policy/durability.md", auditor_id: "au_kate" } },
    { index: 13, name: "AttestationIssued", source: "outcome", emitted_by_engagement: "auditor_engagement", at: "2026-06-10T16:32:00Z",
      payload: { attestation_id: "at_1", verdict: "approve", rationale: "meets policy" } },
    { index: 14, name: "MilestoneShipped", source: "outcome", emitted_by_engagement: "techlead_engagement", at: "2026-06-10T16:50:00Z",
      payload: { milestone_id: "M-101", shipper_id: "tl_alice" } },
  ],
  research_artifact_ids: ["ra_1"],
  strategy_decision_ids: ["sd_1"],
  design_ids: ["d_1"],
  milestone_id: "M-101",
  code_change_ids: ["cc_1"],
  test_plan_ids: ["tp_1"],
  test_run_ids: [],
  defect_ids: [],
  attestation_ids: ["at_1"],
}

// Entity rows produced by the conversation. Each row reflects the
// state the entity reached when the matching apply succeeded inside
// its persona engagement (or — for entities the orchestrator never
// directly mutates — the state implied by the outcome event).
export const entityRows: EntityRow[] = [
  {
    entity_kind: "ResearchArtifact",
    id: "ra_1",
    state: "CONSUMED",
    version: 4,
    data: {
      artifact_id: "ra_1",
      subject: "prior art on conversation durability",
      requester_id: "tl_alice",
      assignee_id: "rs_bob",
      artifact_ref: "/docs/research/durability.md",
      citations: "RAFT;Calvin;FoundationDB",
      summary: "WAL-backed is mainstream",
      created_at: "2026-06-10T14:03:00Z",
      synthesized_at: "2026-06-10T14:24:00Z",
      consumed_at: "2026-06-10T14:27:00Z",
    },
  },
  {
    entity_kind: "StrategyDecision",
    id: "sd_1",
    state: "COMMITTED",
    version: 2,
    data: {
      decision_id: "sd_1",
      subject: "durability approach",
      options_ref: "/docs/strategy/durability-options.md",
      recommended_option: "WAL-backed",
      chosen_option: "WAL-backed",
      commit_rationale: "matches existing infra",
      drafter_id: "st_diana",
      decider_id: "dc_eric",
      drafted_at: "2026-06-10T14:27:00Z",
      decided_at: "2026-06-10T14:42:00Z",
    },
  },
  {
    entity_kind: "Design",
    id: "d_1",
    state: "APPROVED",
    version: 2,
    data: {
      design_id: "d_1",
      subject: "WAL-backed durability",
      draft_ref: "/docs/design/durability.md",
      research_artifact_id: "ra_1",
      strategy_decision_id: "sd_1",
      author_id: "ar_fran",
      approver_id: "ap_greg",
      approval_rationale: "tradeoffs documented; sound",
      drafted_at: "2026-06-10T14:45:00Z",
      approved_at: "2026-06-10T15:10:00Z",
    },
  },
  {
    entity_kind: "Milestone",
    id: "M-101",
    state: "SHIPPED",
    version: 5,
    data: {
      milestone_id: "M-101",
      subject: "WAL-backed durability impl",
      design_ref: "/docs/design/durability.md",
      carver_id: "tl_alice",
      claimed_by_id: "dev_chris",
      shipper_id: "tl_alice",
      carved_at: "2026-06-10T15:13:00Z",
      claimed_at: "2026-06-10T15:14:00Z",
      shipped_at: "2026-06-10T16:50:00Z",
    },
  },
  {
    entity_kind: "CodeChange",
    id: "cc_1",
    state: "DEPLOYED",
    version: 5,
    data: {
      change_id: "cc_1",
      subject: "wire WAL into engine",
      milestone_id: "M-101",
      diff_ref: "/pr/123",
      author_id: "dev_chris",
      reviewer_id: "dev_hank",
      review_verdict: "approve",
      review_rationale: "lgtm",
      deploy_ref: "build_42",
      proposed_at: "2026-06-10T15:16:00Z",
      merged_at: "2026-06-10T15:50:00Z",
      deployed_at: "2026-06-10T15:55:00Z",
    },
  },
  {
    entity_kind: "TestPlan",
    id: "tp_1",
    state: "READY",
    version: 2,
    data: {
      plan_id: "tp_1",
      subject: "durability tests",
      milestone_id: "M-101",
      plan_ref: "/docs/tests/durability.md",
      author_id: "qa_iris",
      drafted_at: "2026-06-10T15:58:00Z",
    },
  },
  {
    entity_kind: "Attestation",
    id: "at_1",
    state: "ISSUED",
    version: 2,
    data: {
      attestation_id: "at_1",
      target_kind: "code-change",
      target_ref: "cc_1",
      policy_ref: "/policy/durability.md",
      auditor_id: "au_kate",
      verdict: "approve",
      rationale: "meets policy",
      issued_at: "2026-06-10T16:32:00Z",
    },
  },
  ...actors.map<EntityRow>((a) => ({
    entity_kind: "Actor",
    id: a.actor_id,
    state: "AVAILABLE",
    version: 1,
    data: {
      actor_id: a.actor_id,
      role: a.role,
      display_name: a.display_name,
      kind: a.kind,
      status: a.status ?? "available",
      created_at: "2026-06-10T00:00:00Z",
    },
  })),
]

export function findActor(id: string): Actor | undefined {
  return actors.find((a) => a.actor_id === id)
}

export function findEntity(kind: string, id: string): EntityRow | undefined {
  return entityRows.find((r) => r.entity_kind === kind && r.id === id)
}
