import { Link, useNavigate, useParams } from "react-router-dom"
import { schemas } from "../data/schema"
import { findEntity, findActor } from "../data/fixtures"
import { StateBadge } from "../components/StateBadge"
import { ActorChip } from "../components/ActorChip"
import type { EntityFieldSpec, EntityKind } from "../types"

export function EntityDetail() {
  const navigate = useNavigate()
  const { kind, id } = useParams()
  if (!kind || !id) return <div className="text-stone-600">Missing entity reference.</div>
  const decodedId = decodeURIComponent(id)
  const row = findEntity(kind, decodedId)
  if (!row) {
    return <div className="text-stone-600">No {kind} row found for <code className="mono">{decodedId}</code>.</div>
  }
  const schema = schemas[kind as EntityKind]
  if (!schema) {
    return <div className="text-stone-600">No schema registered for {kind}.</div>
  }

  // Group fields by their @group annotation, preserving the order
  // each group appears in.
  const groupOrder: string[] = []
  const grouped: Record<string, EntityFieldSpec[]> = {}
  for (const f of schema.fields) {
    const g = f.group ?? "—"
    if (!grouped[g]) {
      grouped[g] = []
      groupOrder.push(g)
    }
    grouped[g].push(f)
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-block text-sm text-stone-500 hover:text-stone-700 cursor-pointer"
      >
        ← Back
      </button>
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">{schema.title}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 mono">{decodedId}</h1>
        </div>
        <div className="text-right">
          <StateBadge state={row.state} />
          <div className="mt-1 text-[11px] text-stone-400 mono">version {row.version}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {groupOrder.map((g) => (
          <section key={g} className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">{g}</h2>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              {grouped[g].map((f) => (
                <FieldRow
                  key={f.name}
                  spec={f}
                  value={f.name === "state" ? row.state : f.name === "version" ? row.version : row.data[f.name]}
                />
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}

function FieldRow({ spec, value }: { spec: EntityFieldSpec; value: unknown }) {
  return (
    <>
      <dt className="text-stone-500 flex items-center gap-1">
        {spec.label}
        {spec.readonly && <span className="text-[10px] text-stone-300 uppercase tracking-wide">ro</span>}
      </dt>
      <dd>{renderValue(spec, value)}</dd>
    </>
  )
}

function renderValue(spec: EntityFieldSpec, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-stone-300">∅</span>
  }

  // Actor reference detection — matches our fixture id scheme.
  if (
    spec.nav?.view === "actor.detail" &&
    typeof value === "string" &&
    findActor(value)
  ) {
    return <ActorChip id={value} />
  }

  if (spec.nav && typeof value === "string") {
    const viewToKind: Record<string, string> = {
      "milestone.detail": "Milestone",
      "design.detail": "Design",
      "research-artifact.detail": "ResearchArtifact",
      "strategy-decision.detail": "StrategyDecision",
      "code-change.detail": "CodeChange",
      "test-plan.detail": "TestPlan",
      "test-run.detail": "TestRun",
      "defect-report.detail": "DefectReport",
      "attestation.detail": "Attestation",
    }
    const target = viewToKind[spec.nav.view]
    if (target) {
      return (
        <Link
          to={`/entity/${target}/${encodeURIComponent(value)}`}
          className="text-violet-700 underline mono"
        >
          {value}
        </Link>
      )
    }
  }

  if (spec.format === "machine_state" && typeof value === "string") {
    return <StateBadge state={value} />
  }

  if (spec.format === "timestamp" && typeof value === "string") {
    return (
      <span className="mono text-stone-700" title={value}>
        {new Date(value).toLocaleString()}
      </span>
    )
  }

  if (spec.format === "id" && typeof value === "string") {
    return <span className="mono text-stone-800">{value}</span>
  }

  return <span className="text-stone-800 break-words">{String(value)}</span>
}
