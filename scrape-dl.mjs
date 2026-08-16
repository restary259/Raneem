import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "public", "lovable-uploads", "schools");

const LIST = [
  // ================= F+U Academy =================
  // School-level
  ["fu-academy", "school", "campus", "https://academy-languages.com/wp-content/uploads/2025/10/sprachkurse-in-heidelberg-klassenzimmer-auf-dem-campus-aussenansicht-1024x683.jpg"],
  ["fu-academy", "school", "classroom", "https://academy-languages.com/wp-content/uploads/2025/10/sprachkurs-in-heidelberg-schueler-konzentrieren-sich-im-unterricht.jpg"],
  ["fu-academy", "school", "hero", "https://academy-languages.com/wp-content/uploads/2025/08/a1-sprachkurs-fuer-zwei-studierende-am-campus-heidelberg.jpg"],
  ["fu-academy", "program", "intensive-course", "https://academy-languages.com/wp-content/uploads/2025/08/b1-sprachkurs-in-heidelberg-englisch-und-deutsch-studentengruppe.jpg"],
  // Category E - Bergheim (F+U Bildungscampus)
  ["fu-academy", "accommodation", "category-e-bergheim-1", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer2_052-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-e-bergheim-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer2_057-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-e-bergheim-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Aussen_ADN6438_2-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-e-bergheim-4", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer1_041-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-e-bergheim-5", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer2_049-2048x1365.jpg"],
  // Category E - Märzgasse Old Town
  ["fu-academy", "accommodation", "category-e-maerzgasse-1", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer3_023-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-e-maerzgasse-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer3_025-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-e-maerzgasse-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer3_027-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-e-maerzgasse-4", "https://academy-languages.com/wp-content/uploads/2026/02/IMG_2081-2048x1365.jpg"],
  // Category D - Kurfürstenanlage (one-bedroom flats)
  ["fu-academy", "accommodation", "category-d-1", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer1_032-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-d-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer1_037-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-d-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Zimmer1_041-1-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-d-4", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Aussen_ADN6432_2-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-d-5", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Kurfuerstenanlage_70_Kueche_043-2048x1365.jpg"],
  // Category C - Märzgasse old town
  ["fu-academy", "accommodation", "category-c-1", "https://academy-languages.com/wp-content/uploads/2026/02/IMG_2081-1-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-c-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer1_005-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-c-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer1_008-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-c-4", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer1_012-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-c-5", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Maerzgasse_26_Zimmer2_021-2048x1365.jpg"],
  // Category B+ - Franz-Marc-Strasse 19
  ["fu-academy", "accommodation", "category-bplus-1", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Kueche_a-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-bplus-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Zimmer-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-bplus-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Aussen_ADN6498-2048x1365.jpg"],
  // Category B - Schmitt Kirchheim
  ["fu-academy", "accommodation", "category-b-schmitt-1", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Aussen_ADN6457-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-b-schmitt-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Kueche_077-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-b-schmitt-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Zimmer2_071-2048x1365.jpg"],
  // Category A - Schmitt
  ["fu-academy", "accommodation", "category-a-schmitt-1", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Aussen_ADN6456-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-schmitt-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Dusche_076-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-schmitt-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Schmitthennerstr_1_Zimmer1_064-2048x1365.jpg"],
  // Category A - Concordia
  ["fu-academy", "accommodation", "category-a-concordia-1", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Rohrbacher-Strasse_126_Kueche-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-concordia-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Rohrbacher-Strasse_126_Zimmer1_011-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-concordia-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Rohrbacher-Strasse_126_Aussen_ADN6487-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-concordia-4", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Rohrbacher-Strasse_126_Bad-2048x1365.jpg"],
  // Category A - Turnerstrasse
  ["fu-academy", "accommodation", "category-a-turner-1", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Aussen_ADN6498-1-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-turner-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Kueche_a-1-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-turner-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Franz-Marc-Strasse_19_Zimmer-1-2048x1365.jpg"],
  // Category A - Franz-Marc-Straße
  ["fu-academy", "accommodation", "category-a-franzmarc-1", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Turnerstrasse_165_Zimmer1-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-franzmarc-2", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Turnerstrasse_165_Aussen_ADN6506-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-franzmarc-3", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Turnerstrasse_165_Bad-2048x1365.jpg"],
  ["fu-academy", "accommodation", "category-a-franzmarc-4", "https://academy-languages.com/wp-content/uploads/2026/02/FuU2026101_Turnerstrasse_165_Kueche-2048x1365.jpg"],

  // ================= Alpha Aktiv =================
  ["alpha-aktiv", "school", "residence", "https://www.alpha-heidelberg.de/images/SjTPabqImX-600.webp"],
  ["alpha-aktiv", "school", "classroom", "https://www.alpha-heidelberg.de/images/aO06z9tK5M-600.webp"],
  ["alpha-aktiv", "school", "hero", "https://www.alpha-heidelberg.de/images/vD0WeBOcXF-1500.webp"],

  // ================= GO Academy =================
  ["go-academy", "school", "logo", "https://goacademy.de/fileadmin/introduction/images/goacademy_sprachschule_duesseldorf_international_house_dusseldorf.png"],
  ["go-academy", "program", "intensive-course", "https://goacademy.de/fileadmin/_processed_/8/0/csm_goacademy_sprachschule_duesseldorf_deutsch-intensivkurs-mit-unterkunft_0b0fd37470.jpeg"],
  ["go-academy", "school", "accommodation-hero", "https://goacademy.de/fileadmin/_processed_/4/2/csm_csm_goacademy.de_sprachschule_duesseldorf_unterkunft_accommodation_in_dusseldorf_1e4f3f55c0_f0e05c1095.jpg"],

  // ================= KAPITO =================
  ["kapito", "program", "intensive-course", "https://www.kapito.com/wp-content/uploads/2019/01/KAPITO-Intensivkurs-Kursbild01.jpg"],
  ["kapito", "program", "intensive-plus", "https://www.kapito.com/wp-content/uploads/2019/01/KAPITO-Intensivkurs01.jpg"],
  ["kapito", "school", "standard-course", "https://www.kapito.com/wp-content/uploads/2019/01/KAPITO-Standardkurs-Kursbild01.jpg"],
  ["kapito", "accommodation", "homestay-1", "https://www.kapito.com/wp-content/uploads/2019/07/KAPITO-Unterkunft-Slide03.jpg"],
  ["kapito", "accommodation", "homestay-2", "https://www.kapito.com/wp-content/uploads/2025/11/unterkunft03-800.jpg"],
  ["kapito", "accommodation", "homestay-3", "https://www.kapito.com/wp-content/uploads/2025/11/unterkunft04-800.jpg"],
  ["kapito", "accommodation", "studio1-1", "https://www.kapito.com/wp-content/uploads/2025/05/KAPITO-Studio1-06-300.jpg"],
  ["kapito", "accommodation", "studio1-2", "https://www.kapito.com/wp-content/uploads/2025/05/KAPITO-Studio1-01-300.jpg"],
  ["kapito", "accommodation", "studio2-1", "https://www.kapito.com/wp-content/uploads/2023/08/KAPITO-Studio2-01-300.jpg"],
  ["kapito", "accommodation", "studio2-2", "https://www.kapito.com/wp-content/uploads/2025/05/KAPITO-Studio2-43-300.jpg"],
  ["kapito", "accommodation", "studio3-1", "https://www.kapito.com/wp-content/uploads/2025/05/KAPITO-Studio3-60-300.jpg"],
  ["kapito", "accommodation", "studio3-2", "https://www.kapito.com/wp-content/uploads/2025/05/KAPITO-Studio3-72-300.jpg"],
  ["kapito", "accommodation", "studio4-1", "https://www.kapito.com/wp-content/uploads/2025/05/KAPITO-Studio4-21-300.jpg"],
  ["kapito", "accommodation", "studio4-2", "https://www.kapito.com/wp-content/uploads/2025/05/KAPITO-Studio4-02-300.jpg"],
  ["kapito", "accommodation", "studio-generic", "https://www.kapito.com/wp-content/uploads/2024/02/studio02-600pxh.jpg"],
];

function ext(url) {
  const m = url.split("?")[0].match(/\.(jpe?g|png|webp|gif|svg)(?:$|-)/i);
  return m ? m[1].toLowerCase() : "jpg";
}

const results = [];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function download(url, dest) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "image/*,*/*" }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error("tiny body");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  return buf.length;
}

for (const [slug, kind, name, url] of LIST) {
  const dir = join(ROOT, slug, kind === "school" ? "school" : kind === "program" ? "programs" : "accommodations");
  const dest = join(dir, `${name}.${ext(url)}`);
  if (existsSync(dest)) {
    results.push({ name, status: "exists", size: 0 });
    continue;
  }
  try {
    const size = await download(url, dest);
    results.push({ name, status: "ok", size });
  } catch (err) {
    results.push({ name, status: "FAIL", err: String(err).slice(0, 80), url });
  }
}

writeFileSync(join(process.cwd(), "dump", "_download_results.json"), JSON.stringify(results, null, 1));
const ok = results.filter((r) => r.status === "ok").length;
const ex = results.filter((r) => r.status === "exists").length;
const fail = results.filter((r) => r.status === "FAIL");
console.log(`ok=${ok} exists=${ex} fail=${fail.length}`);
fail.forEach((f) => console.log("FAIL", f.name, f.err, f.url));