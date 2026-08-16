import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "dump");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
for (const f of files) {
  const d = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  console.log("\n" + "=".repeat(90));
  console.log("IMAGES for:", f);
  d.images.forEach((img, i) => {
    console.log(
      `[${i}] ${img.width}x${img.height} alt="${(img.alt || "").slice(0, 60)}" sec="${(img.section || "").slice(0, 70)}"`,
      "\n    URL:", img.url,
    );
  });
}