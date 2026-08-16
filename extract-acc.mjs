import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dumpDir = join(__dirname, "dump");

const files = [
  ["fu-int", "fu-academy__https___academy_languages_com_en_german_courses_intensive_courses_heidelberg_.json"],
  ["fu-acc", "fu-academy__https___academy_languages_com_en_accommodation_heidelberg_dormitories_apartments_heidelber.json"],
  ["alpha-course", "alpha-aktiv__https___www_alpha_heidelberg_de_en_language_courses_german_courses_.json"],
  ["alpha-acc", "alpha-aktiv__https___www_alpha_heidelberg_de_en_service_accommodation_.json"],
  ["alpha-ins", "alpha-aktiv__https___www_alpha_heidelberg_de_en_service_health_insurance_.json"],
  ["go-int", "go-academy__https___goacademy_de_en_language_courses_german_german_intensive_course_.json"],
  ["go-acc", "go-academy__https___goacademy_de_en_support_accommodation_.json"],
  ["kap-int", "kapito__https___www_kapito_com_en_german_intensive_course_.json"],
  ["kap-plus", "kapito__https___www_kapito_com_en_intensive_plus_course_.json"],
  ["kap-acc", "kapito__https___www_kapito_com_en_accommodation_.json"],
];

const out = [];
for (const [key, fn] of files) {
  const p = join(dumpDir, fn);
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, "utf8"));
  out.push(`\n\n======== ${key} (${fn}) ========`);
  out.push(`TITLE: ${j.title || ""}`);
  out.push(`URL: ${j.url || ""}`);
  if (j.bodyText && Array.isArray(j.bodyText)) {
    for (const b of j.bodyText) {
      const t = typeof b === "string" ? b : `${b.heading || ""} :: ${b.text || ""}`;
      out.push(`BT: ${t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")}`);
    }
  }
  if (Array.isArray(j.raw)) {
    for (const im of j.raw) out.push(`RAW: ${im.alt || ""} :: ${im.src || ""}`);
  }
}
const dest = join(dumpDir, "_extracted.txt");
writeFileSync(dest, out.join("\n"));
console.log("wrote", dest, out.join("\n").length, "chars");