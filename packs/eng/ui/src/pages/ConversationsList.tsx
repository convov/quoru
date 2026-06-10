import { Link } from "react-router-dom"
import { conversation, findActor } from "../data/fixtures"
import { StateBadge } from "../components/StateBadge"

export function ConversationsList() {
  // For now there's exactly one fixture conversation; structure
  // ready to iterate across many when the BFF projector lands.
  const conversations = [conversation]
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Conversations</h1>
        <span className="text-sm text-stone-500">{conversations.length} active</span>
      </div>
      <ul className="space-y-2">
        {conversations.map((c) => (
          <li key={c.conversation_id}>
            <Link
              to={`/conversation/${c.conversation_id}`}
              className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-300 hover:shadow-sm transition"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-semibold text-stone-900">{c.subject}</h2>
                <StateBadge state={c.current_state} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm text-stone-600">
                <span className="mono text-xs text-stone-400">{c.conversation_id}</span>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500">started by</span>
                <span className="font-medium text-stone-700">{findActor(c.originator_id)?.display_name ?? c.originator_id}</span>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500">{c.events.length} events</span>
                {c.milestone_id && (
                  <>
                    <span className="text-stone-300">·</span>
                    <span className="text-stone-500">milestone</span>
                    <span className="mono text-xs bg-stone-100 px-1.5 py-0.5 rounded">
                      {c.milestone_id}
                    </span>
                  </>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
