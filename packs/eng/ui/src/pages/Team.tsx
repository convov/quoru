import { Link } from "react-router-dom"
import { actors } from "../data/fixtures"
import { ActorChip } from "../components/ActorChip"

export function Team() {
  // Group actors by role kind (agent vs human) to make the
  // human touchpoints visually distinct — docs/packs/eng.md
  // calls out 3 human-typed roles in the minimum viable team.
  const agents = actors.filter((a) => a.kind === "agent")
  const humans = actors.filter((a) => a.kind === "human")
  return (
    <div className="space-y-6">
      <Link to="/" className="inline-block text-sm text-stone-500 hover:text-stone-700">← Conversations</Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Team</h1>
        <p className="mt-1 text-sm text-stone-600">
          The Actor entity instances for the eng pack — agents + human-typed roles per docs/packs/eng.md.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
          Agents ({agents.length})
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((a) => (
            <li key={a.actor_id} className="rounded-lg border border-stone-200 bg-white p-3">
              <ActorChip id={a.actor_id} />
              <div className="mt-2 text-xs text-stone-500 mono">{a.actor_id}</div>
              <div className="text-xs text-stone-500 capitalize">{a.role}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
          Humans ({humans.length})
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {humans.map((a) => (
            <li key={a.actor_id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
              <ActorChip id={a.actor_id} />
              <div className="mt-2 text-xs text-stone-500 mono">{a.actor_id}</div>
              <div className="text-xs text-stone-500 capitalize">{a.role}</div>
              <div className="mt-2 text-[11px] text-amber-700 uppercase tracking-wide">human touchpoint</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
