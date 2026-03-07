/**
 * gradeConverter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bagrut → German grade conversion using the Modified Bavarian Formula.
 *
 * Formula:  german = 1 + 3 × (N_max − N_d) / (N_max − N_min)
 *
 * NOTE: External services such as uni-assist may apply different
 * conversion rules. Always verify with the receiving institution.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface GradeResult {
  /** Rounded to 2 decimal places */
  german: number;
  interpretation: "Very good" | "Good" | "Satisfactory" | "Pass" | "Fail";
  formulaString: string;
}

export interface BatchGradeResult {
  input: number;
  german: number;
  interpretation: GradeResult["interpretation"];
}

/**
 * Converts a single Bagrut score to its German grade equivalent.
 *
 * @param bagrut   Score between 0 and 100 (inclusive)
 * @param N_max    Maximum possible score (default 100)
 * @param N_min    Minimum passing score (default 55 — configurable)
 *
 * @throws Error for scores outside [0, 100] or non-numeric input
 *
 * @example
 *   bagrutToGermanGrade(90)   → { german: 1.67, interpretation: "Good", ... }
 *   bagrutToGermanGrade(100)  → { german: 1.00, interpretation: "Very good", ... }
 *   bagrutToGermanGrade(55)   → { german: 4.00, interpretation: "Pass", ... }
 *   bagrutToGermanGrade(54)   → { german: 4.07, interpretation: "Fail", ... }
 */
export function bagrutToGermanGrade(bagrut: number, N_max = 100, N_min = 55): GradeResult {
  if (typeof bagrut !== "number" || isNaN(bagrut)) {
    throw new Error("Bagrut score must be a number");
  }
  if (bagrut < 0 || bagrut > 100) {
    throw new Error(`Bagrut score must be between 0 and 100 (received ${bagrut})`);
  }
  if (N_max <= N_min) {
    throw new Error("N_max must be greater than N_min");
  }

  // Modified Bavarian Formula
  const german = 1 + (3 * (N_max - bagrut)) / (N_max - N_min);
  const gRounded = Math.round(german * 100) / 100;

  let interpretation: GradeResult["interpretation"];
  if (gRounded <= 1.5) {
    interpretation = "Very good";
  } else if (gRounded <= 2.5) {
    interpretation = "Good";
  } else if (gRounded <= 3.5) {
    interpretation = "Satisfactory";
  } else if (gRounded <= 4.0) {
    interpretation = "Pass";
  } else {
    interpretation = "Fail";
  }

  return {
    german: gRounded,
    interpretation,
    formulaString: `1 + 3 × (${N_max} − ${bagrut}) / (${N_max} − ${N_min}) = ${gRounded}`,
  };
}

/**
 * Batch-converts an array of Bagrut scores.
 * Invalid entries are returned with german: -1 and interpretation: "Fail".
 */
export function bagrutBatchConvert(scores: number[], N_max = 100, N_min = 55): BatchGradeResult[] {
  return scores.map((score) => {
    try {
      const result = bagrutToGermanGrade(score, N_max, N_min);
      return { input: score, german: result.german, interpretation: result.interpretation };
    } catch {
      return { input: score, german: -1, interpretation: "Fail" as const };
    }
  });
}

/**
 * Parses a newline or comma-separated string of scores for batch conversion.
 * Returns { scores, errors } where errors lists invalid lines.
 */
export function parseBatchInput(raw: string): {
  scores: number[];
  errors: string[];
} {
  const lines = raw
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const scores: number[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const n = parseFloat(line);
    if (isNaN(n) || n < 0 || n > 100) {
      errors.push(`"${line}" is not a valid Bagrut score (0–100)`);
    } else {
      scores.push(n);
    }
  }

  return { scores, errors };
}
