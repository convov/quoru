// Pill that colors a state name based on its category.
// SHIPPED / APPROVED / COMMITTED / etc. — green
// DRAINED / WITHDRAWN / REJECTED / ABANDONED / FAILED — red
// IN_PROGRESS / RUNNING / *_IN_FLIGHT — amber
// READY / DRAFTED / PENDING — slate
// other — neutral

type Tone = "green" | "red" | "amber" | "slate" | "neutral"

function classify(state: string): Tone {
  const upper = state.toUpperCase()
  if (/SHIPPED|APPROVED|COMMITTED|CONSUMED|ISSUED|MERGED|DEPLOYED|SYNTHESIZED|PASSED|SIGNED_OFF/.test(upper)) return "green"
  if (/DRAINED|WITHDRAWN|REJECTED|ABANDONED|FAILED|RETIRED|REJ/.test(upper)) return "red"
  if (/IN_PROGRESS|RUNNING|IN_FLIGHT|AWAITING|MONITORING|REVIEWING|TRIAGING|DRAFTING/.test(upper)) return "amber"
  if (/READY|DRAFTED|PENDING|REQUESTED|PROPOSED|CARVED|CLAIMED|NEW|COMMISSIONED|DESIGNING|STRATEGIZING|RESEARCHING|FRAMED|SKIPPED|DELIVERED/.test(upper)) return "slate"
  return "neutral"
}

const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  red: "bg-red-100 text-red-800 ring-red-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
}

export function StateBadge({ state }: { state: string }) {
  const tone = classify(state)
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset mono ${toneClasses[tone]}`}>
      {state}
    </span>
  )
}
