import { exec } from "child_process"

function escape(s) {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "")   // single quotes break osascript -e
    .replace(/\n/g, " ")
    .slice(0, 220)
}

export function notify(title, body, subtitle = "") {
  const t = escape(title.slice(0, 60))
  const b = escape(body)
  const s = escape(subtitle.slice(0, 60))
  let script = `display notification "${b}" with title "${t}"`
  if (s) script += ` subtitle "${s}"`
  exec(`osascript -e '${script}'`, err => {
    if (err) console.error("[notify]", err.message)
  })
}

// Send one grouped notification for a list of headline strings
export function notifyList(title, headlines, subtitle = "") {
  if (!headlines.length) return
  const body = headlines
    .slice(0, 4)
    .map((h, i) => `${i + 1}. ${h}`)
    .join("  |  ")
  notify(title, body, subtitle)
}
