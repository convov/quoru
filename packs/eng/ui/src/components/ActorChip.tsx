import { Link } from "react-router-dom"
import { findActor } from "../data/fixtures"

const roleStyle: Record<string, string> = {
  techlead:   "bg-purple-100 text-purple-800 ring-purple-200",
  researcher: "bg-sky-100 text-sky-800 ring-sky-200",
  strategist: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  architect:  "bg-blue-100 text-blue-800 ring-blue-200",
  dev:        "bg-emerald-100 text-emerald-800 ring-emerald-200",
  qa:         "bg-orange-100 text-orange-800 ring-orange-200",
  auditor:    "bg-rose-100 text-rose-800 ring-rose-200",
  decider:    "bg-violet-100 text-violet-800 ring-violet-200",
  approver:   "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200",
  "qa-owner": "bg-amber-100 text-amber-800 ring-amber-200",
}

export function ActorChip({ id }: { id: string }) {
  const a = findActor(id)
  if (!a) {
    return <span className="text-stone-500 mono text-xs">{id}</span>
  }
  const style = roleStyle[a.role] ?? "bg-stone-100 text-stone-700 ring-stone-200"
  return (
    <Link
      to={`/entity/Actor/${id}`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ring-1 ring-inset hover:underline ${style}`}
    >
      <span className="font-medium">{a.display_name}</span>
      {a.kind === "human" && <span className="text-[10px] uppercase opacity-70">(H)</span>}
    </Link>
  )
}
