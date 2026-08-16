import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "dump");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const out = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  const lines = [];
  lines.push("=".repeat(100));
  lines.push(`FILE: ${f}`);
  lines.push(`URL: ${d.url}`);
  lines.push(`TITLE: ${d.title}  LANG: ${d.lang}  ERROR: ${d.error ?? "-"}`);
  lines.push("=".repeat(100));
  for (const b of d.bodyText || []) {
    lines.push(`\n### <${b.heading || "NO HEADING"}>\n${b.text}`);
  }
  if (d.cards && d.cards.tables && d.cards.tables.length) {
    lines.push("\n#### TABLES");
    d.cards.tables.forEach((t, ti) => {
      lines.push(`\n[TABLE ${ti}]${t.head.join(" / ")}`);
      t.rows.forEach((r) => lines.push("  | " + r.join("  | ")));
    });
  }
  out.push(lines.join("\n"));
}
const outFile = join(process.cwd(), "dump", "_ALL_SUMMARY.txt");
writeFileSync(outFile, out.join("\n\n"));
console.log("wrote", outFile, out.join("\n").length, "chars,", files.length, "files");