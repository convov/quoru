import { Link, Outlet } from "react-router-dom"

export function Layout() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="size-7 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500" />
            <div>
              <div className="font-semibold text-stone-900 group-hover:underline">Quoru</div>
              <div className="text-xs text-stone-500 -mt-0.5">eng pack · v1</div>
            </div>
          </Link>
          <nav className="text-sm flex items-center gap-4">
            <Link to="/" className="text-stone-600 hover:text-stone-900">Conversations</Link>
            <Link to="/team" className="text-stone-600 hover:text-stone-900">Team</Link>
            <span className="text-xs text-amber-700 bg-amber-100 rounded-md px-2 py-1 ring-1 ring-amber-200">
              fixture mode · M741 pending
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-stone-400 mono">
        packs/eng · 10 entities · 11 workflows · 31 hermetic tests
      </footer>
    </div>
  )
}
