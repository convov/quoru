// Capture the visible top fold (above-the-fold) at desktop width
// instead of a full-page tall capture. Useful for the conversation
// detail which is long and shrinks badly in a full-page screenshot.

import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

const BASE = process.env.QUORU_UI_URL ?? "http://localhost:5173"
const OUT = resolve(import.meta.dirname, "..", "screenshots")
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ["--no-sandbox"] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto(`${BASE}/conversation/conv_m101`, { waitUntil: "networkidle" })
await page.waitForTimeout(200)
await page.screenshot({
  path: resolve(OUT, "02-conversation-detail-top.png"),
  fullPage: false,
})
console.log("captured top fold")
await browser.close()
