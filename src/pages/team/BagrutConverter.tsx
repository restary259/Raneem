import React, { useState, useCallback } from "react";
import { Calculator, Info, Copy, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { bagrutToGermanGrade, bagrutBatchConvert, parseBatchInput } from "@/utils/gradeConverter";
import type { GradeResult } from "@/utils/gradeConverter";

/* ── Small UI helpers ───────────────────────────────────────────────── */
const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
  >
    {children}
  </div>
);

const gradeColor = (g: number) => {
  if (g <= 1.5) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (g <= 2.5) return "text-green-700 bg-green-50 border-green-200";
  if (g <= 3.5) return "text-amber-700 bg-amber-50 border-amber-200";
  if (g <= 4.0) return "text-orange-700 bg-orange-50 border-orange-200";
  return "text-red-700 bg-red-50 border-red-200";
};

/* ── Main Component ─────────────────────────────────────────────────── */
export default function BagrutConverter() {
  // Single mode
  const [singleScore, setSingleScore] = useState("");
  const [singleResult, setSingleResult] = useState<GradeResult | null>(null);
  const [singleError, setSingleError] = useState("");
  const [copiedSingle, setCopiedSingle] = useState(false);

  // Batch mode
  const [batchInput, setBatchInput] = useState("");
  const [batchResults, setBatchResults] = useState<
    Array<{ input: number; german: number; interpretation: string }>
  >([]);
  const [batchErrors, setBatchErrors] = useState<string[]>([]);
  const [copiedBatch, setCopiedBatch] = useState(false);

  // Config
  const [nMin, setNMin] = useState(55);
  const [showConfig, setShowConfig] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mode, setMode] = useState<"single" | "batch">("single");

  const convertSingle = useCallback(() => {
    setSingleError("");
    setSingleResult(null);
    const n = parseFloat(singleScore);
    try {
      const result = bagrutToGermanGrade(n, 100, nMin);
      setSingleResult(result);
    } catch (e: any) {
      setSingleError(e.message);
    }
  }, [singleScore, nMin]);

  const convertBatch = useCallback(() => {
    const { scores, errors } = parseBatchInput(batchInput);
    setBatchErrors(errors);
    if (scores.length > 0) {
      setBatchResults(bagrutBatchConvert(scores, 100, nMin));
    } else {
      setBatchResults([]);
    }
  }, [batchInput, nMin]);

  const copySingle = async () => {
    if (!singleResult) return;
    await navigator.clipboard.writeText(
      `Bagrut: ${singleScore} → German: ${singleResult.german} (${singleResult.interpretation})`
    );
    setCopiedSingle(true);
    setTimeout(() => setCopiedSingle(false), 2000);
  };

  const copyBatch = async () => {
    if (!batchResults.length) return;
    const text = batchResults
      .map((r) => `${r.input}\t${r.german}\t${r.interpretation}`)
      .join("\n");
    await navigator.clipboard.writeText("Bagrut\tGerman\tInterpretation\n" + text);
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2000);
  };

  const reset = () => {
    setSingleScore("");
    setSingleResult(null);
    setSingleError("");
    setBatchInput("");
    setBatchResults([]);
    setBatchErrors([]);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-600" />
            Bagrut → German Grade Converter
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Modified Bavarian Formula: 1 + 3 × (100 − N) / (100 − N_min)
          </p>
        </div>
        <button
          className="text-slate-400 hover:text-indigo-600 transition-colors"
          onClick={() => setShowTooltip(!showTooltip)}
          title="About this converter"
        >
          <Info className="h-5 w-5" />
        </button>
      </div>

      {/* Info tooltip */}
      {showTooltip && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-medium">Important Note</p>
            <p className="mt-0.5">
              This converter uses the Modified Bavarian Formula with N_min = {nMin}.
              External services such as{" "}
              <strong>uni-assist</strong> may apply different conversion rules or
              thresholds. Always verify the converted grade with the receiving
              institution before submitting applications.
            </p>
          </div>
        </div>
      )}

      {/* Config */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className="text-xs text-indigo-600 hover:underline"
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? "Hide" : "Configure"} N_min
        </button>
        {showConfig && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">N_min (passing threshold):</label>
            <input
              type="number"
              min="1"
              max="99"
              value={nMin}
              onChange={(e) => setNMin(parseInt(e.target.value) || 55)}
              className="w-16 border rounded px-2 py-1 text-sm text-center"
            />
            <button
              className="text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setNMin(55)}
            >
              Reset
            </button>
          </div>
        )}
        <button
          className="ms-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
          onClick={reset}
        >
          <RefreshCw className="h-3 w-3" /> Clear all
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            mode === "single"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setMode("single")}
        >
          Single
        </button>
        <button
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            mode === "batch"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setMode("batch")}
        >
          Batch
        </button>
      </div>

      {/* ── SINGLE MODE ── */}
      {mode === "single" && (
        <Card className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Bagrut Score (0–100)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={singleScore}
                onChange={(e) => {
                  setSingleScore(e.target.value);
                  setSingleError("");
                  setSingleResult(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") convertSingle();
                }}
                placeholder="e.g. 90"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={convertSingle}
                disabled={!singleScore}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Convert
              </button>
            </div>
            {singleError && (
              <p className="text-xs text-red-600 mt-1">{singleError}</p>
            )}
          </div>

          {singleResult && (
            <div
              className={`rounded-xl border p-4 flex items-center justify-between ${gradeColor(
                singleResult.german
              )}`}
            >
              <div>
                <p className="text-3xl font-bold">{singleResult.german}</p>
                <p className="text-sm font-medium mt-0.5">
                  {singleResult.interpretation}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  {singleResult.formulaString}
                </p>
              </div>
              <button
                onClick={copySingle}
                className="p-2 rounded-lg hover:bg-black/10 transition-colors"
                title="Copy result"
              >
                {copiedSingle ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          )}

          {/* Grade scale reference */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">
              German Grade Scale
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                { range: "1.0–1.5", label: "Very good (Sehr gut)" },
                { range: "1.6–2.5", label: "Good (Gut)" },
                { range: "2.6–3.5", label: "Satisfactory (Befriedigend)" },
                { range: "3.6–4.0", label: "Pass (Ausreichend)" },
              ].map((g) => (
                <div
                  key={g.range}
                  className="flex justify-between p-1.5 rounded bg-slate-50"
                >
                  <span className="font-mono font-semibold">{g.range}</span>
                  <span className="text-slate-600">{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── BATCH MODE ── */}
      {mode === "batch" && (
        <Card className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Enter scores (one per line, or comma-separated)
            </label>
            <textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder={"90\n85\n75\n60\n55"}
              rows={6}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
            />
          </div>
          <button
            onClick={convertBatch}
            disabled={!batchInput.trim()}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Convert All
          </button>

          {batchErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs font-semibold text-red-700 mb-1">
                Ignored invalid entries:
              </p>
              {batchErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
                  {e}
                </p>
              ))}
            </div>
          )}

          {batchResults.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">
                  {batchResults.length} results
                </p>
                <button
                  onClick={copyBatch}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
                >
                  {copiedBatch ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedBatch ? "Copied!" : "Copy as table (TSV)"}
                </button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                        Bagrut
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                        German
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">
                        Interpretation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResults.map((r, i) => (
                      <tr
                        key={i}
                        className={`border-b last:border-0 ${
                          i % 2 === 0 ? "" : "bg-slate-50/50"
                        }`}
                      >
                        <td className="px-3 py-2 font-mono">{r.input}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold border ${gradeColor(
                              r.german
                            )}`}
                          >
                            {r.german}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {r.interpretation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
