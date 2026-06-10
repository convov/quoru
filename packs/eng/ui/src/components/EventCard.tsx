import type { ConversationEvent } from "../types"
import { ActorChip } from "./ActorChip"

const sourceLabel: Record<ConversationEvent["source"], string> = {
  actor: "actor event",
  outcome: "submachine outcome",
}

const sourceStyle: Record<ConversationEvent["source"], string> = {
  actor: "border-slate-200 bg-white",
  outcome: "border-emerald-200 bg-emerald-50/40",
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function EventCard({ ev }: { ev: ConversationEvent }) {
  return (
    <div className={`rounded-md border ${sourceStyle[ev.source]} p-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs text-stone-500 mono">#{ev.index}</span>
          <span className="text-xs text-stone-400 mono">{fmtTime(ev.at)}</span>
          <h3 className="font-semibold text-stone-900 mono text-sm">{ev.name}</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-stone-400">
          {sourceLabel[ev.source]}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {ev.source === "actor" && ev.actor_id ? (
          <>
            <span className="text-stone-500">from</span>
            <ActorChip id={ev.actor_id} />
          </>
        ) : (
          <span className="text-stone-500 mono">
            from <span className="text-emerald-700">{ev.emitted_by_engagement}</span>
          </span>
        )}
      </div>
      <PayloadTable payload={ev.payload} />
    </div>
  )
}

function PayloadTable({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload)
  if (entries.length === 0) return null
  return (
    <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
      {entries.map(([k, v]) => (
        <PayloadEntry key={k} field={k} value={v} />
      ))}
    </dl>
  )
}

function PayloadEntry({ field, value }: { field: string; value: unknown }) {
  const str = String(value)
  // any `*_id` field except the entity-owning artifact id surfaces as an actor chip when it matches
  if ((field.endsWith("_id") || field === "actorId") && typeof value === "string" && /^(tl_|rs_|st_|dc_|ar_|ap_|dev_|qa_|qo_|au_)/.test(value)) {
    return (
      <>
        <dt className="text-stone-500 mono">{field}</dt>
        <dd>
          <ActorChip id={value} />
        </dd>
      </>
    )
  }
  return (
    <>
      <dt className="text-stone-500 mono">{field}</dt>
      <dd className="text-stone-800 mono break-all">{str || <em className="text-stone-400">∅</em>}</dd>
    </>
  )
}
