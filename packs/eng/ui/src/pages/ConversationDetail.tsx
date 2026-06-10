import { Link, useParams } from "react-router-dom"
import { conversation, entityRows } from "../data/fixtures"
import { StateBadge } from "../components/StateBadge"
import { ActorChip } from "../components/ActorChip"
import { EventCard } from "../components/EventCard"
import type { EntityKind, EntityRow } from "../types"

export function ConversationDetail() {
  const { id } = useParams()
  // Single fixture for now; structure ready for many.
  const c = id === conversation.conversation_id ? conversation : undefined
  if (!c) return <div className="text-stone-600">Conversation not found.</div>

  const buckets: { kind: EntityKind; rows: EntityRow[] }[] = [
    { kind: "Milestone", rows: c.milestone_id ? entitiesOfKind("Milestone", [c.milestone_id]) : [] },
    { kind: "ResearchArtifact", rows: entitiesOfKind("ResearchArtifact", c.research_artifact_ids) },
    { kind: "StrategyDecision", rows: entitiesOfKind("StrategyDecision", c.strategy_decision_ids) },
    { kind: "Design", rows: entitiesOfKind("Design", c.design_ids) },
    { kind: "CodeChange", rows: entitiesOfKind("CodeChange", c.code_change_ids) },
    { kind: "TestPlan", rows: entitiesOfKind("TestPlan", c.test_plan_ids) },
    { kind: "Attestation", rows: entitiesOfKind("Attestation", c.attestation_ids) },
  ]

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-block text-sm text-stone-500 hover:text-stone-700">← Conversations</Link>
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{c.subject}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-stone-600">
            <span className="mono text-xs text-stone-400">{c.conversation_id}</span>
            <span className="text-stone-300">·</span>
            <span>started by</span>
            <ActorChip id={c.originator_id} />
            {c.techlead_id && (
              <>
                <span className="text-stone-300">·</span>
                <span>techlead</span>
                <ActorChip id={c.techlead_id} />
              </>
            )}
          </div>
        </div>
        <StateBadge state={c.current_state} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <section>
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
            Event timeline ({c.events.length})
          </h2>
          <ol className="space-y-2">
            {c.events.map((ev) => (
              <li key={ev.index}>
                <EventCard ev={ev} />
              </li>
            ))}
          </ol>
        </section>

        <aside className="space-y-6">
          {buckets
            .filter((b) => b.rows.length > 0)
            .map((b) => (
              <EntityBucket key={b.kind} kind={b.kind} rows={b.rows} />
            ))}
        </aside>
      </div>
    </div>
  )
}

function entitiesOfKind(kind: EntityKind, ids: string[]): EntityRow[] {
  return entityRows.filter((r) => r.entity_kind === kind && ids.includes(r.id))
}

function EntityBucket({ kind, rows }: { kind: EntityKind; rows: EntityRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-2">
        {kind} ({rows.length})
      </h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              to={`/entity/${kind}/${encodeURIComponent(row.id)}`}
              className="block rounded-md border border-stone-200 bg-white p-3 hover:border-stone-300 hover:shadow-sm transition"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="mono text-sm text-stone-800">{row.id}</div>
                <StateBadge state={row.state} />
              </div>
              {typeof row.data.subject === "string" && (
                <div className="mt-1 text-sm text-stone-600 line-clamp-2">{row.data.subject}</div>
              )}
              <div className="mt-1 text-[11px] text-stone-400 mono">v{row.version}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
