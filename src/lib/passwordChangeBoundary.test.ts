import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");
const HELPER = path.join(SRC, "lib", "changeOwnPassword.ts");
const FUNCTION = path.join(ROOT, "supabase", "functions", "change-own-password", "index.ts");

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("password change trust boundary", () => {
  it("keeps all frontend password mutations behind one helper", () => {
    const offenders = sources(SRC).filter((file) => {
      if (file === HELPER) return false;
      const source = fs.readFileSync(file, "utf8");
      return /auth\.updateUser\s*\(\s*\{\s*password/.test(source)
        || /rpc\s*\(\s*["']clear_must_change_password["']/.test(source)
        || /functions\.invoke\s*\(\s*["']change-own-password["']/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("derives identity from the bearer token and verifies flag persistence", () => {
    const source = fs.readFileSync(FUNCTION, "utf8");
    expect(source).toMatch(/BodySchema[\s\S]*password/);
    expect(source).not.toMatch(/BodySchema[\s\S]{0,250}\buser_?id\b/i);
    expect(source).toMatch(/admin\.auth\.getUser\(token\)/);
    expect(source).toMatch(/same_password/);
    expect(source.indexOf("/auth/v1/user")).toBeLessThan(source.indexOf("must_change_password: false"));
    expect(source).toMatch(/\.select\("must_change_password"\)/);
    expect(source.indexOf("must_change_password !== false")).toBeLessThan(source.indexOf("success: true"));
  });
});