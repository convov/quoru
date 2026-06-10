// Headless-chromium driver that walks every route, captures full-page
// screenshots, and reports console errors. Run from the ui dir:
//   node scripts/screenshot.mjs
// Assumes the Vite dev server is up on http://localhost:5173.

import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

const BASE = process.env.QUORU_UI_URL ?? "http://localhost:5173"
const OUT = resolve(import.meta.dirname, "..", "screenshots")
mkdirSync(OUT, { recursive: true })

const routes = [
  { path: "/", name: "01-conversations-list" },
  { path: "/conversation/conv_m101", name: "02-conversation-detail" },
  { path: "/entity/Milestone/M-101", name: "03-entity-milestone" },
  { path: "/entity/Design/d_1", name: "04-entity-design" },
  { path: "/entity/Actor/tl_alice", name: "05-entity-actor" },
  { path: "/team", name: "06-team" },
]

const browser = await chromium.launch({ args: ["--no-sandbox"] })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const errors = []
page.on("pageerror", (err) => errors.push({ kind: "pageerror", text: err.message }))
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push({ kind: "console.error", text: msg.text() })
})

let ok = 0
for (const r of routes) {
  errors.length = 0
  const url = `${BASE}${r.path}`
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 })
    await page.waitForLoadState("domcontentloaded")
    // Brief settle for any async paint.
    await page.waitForTimeout(200)
    const file = resolve(OUT, `${r.name}.png`)
    await page.screenshot({ path: file, fullPage: true })
    const errSummary = errors.length === 0 ? "no errors" : `${errors.length} console errors`
    console.log(`✓ ${r.path} -> ${file} (${errSummary})`)
    if (errors.length > 0) {
      for (const e of errors) console.log(`    ${e.kind}: ${e.text}`)
    }
    ok++
  } catch (e) {
    console.log(`✗ ${r.path} -> ${e.message}`)
  }
}

console.log(`\nDone: ${ok}/${routes.length} routes captured -> ${OUT}`)
await browser.close()
