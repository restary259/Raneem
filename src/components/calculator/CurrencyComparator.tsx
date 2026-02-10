import { useState, useEffect } from "react";

// Germany-only data
const countries = [
  {
    code: "DE",
    name: "ألمانيا",
    currency: "EUR",
    banks: [
      { id: "deutsche", name: "Deutsche Bank", fee: 2 },
      { id: "commerz", name: "Commerzbank", fee: 2.5 },
      { id: "n26", name: "N26", fee: 0 },
      { id: "sparkasse", name: "Sparkasse", fee: 3 },
    ],
  },
];

async function fetchRate(toCurrency: string, date = "2025-06-16"): Promise<number | null> {
  const url = `https://api.exchangerate.host/convert?from=ILS&to=${toCurrency}&date=${date}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result ?? null;
}

function compareRates(live: number | null, reference: number | null) {
  if (live == null || reference == null) return null;
  if (live > reference) return { diff: live - reference, type: "higher" };
  if (live < reference) return { diff: reference - live, type: "lower" };
  return { diff: 0, type: "same" };
}

export default function CurrencyComparator() {
  const [amount, setAmount] = useState(1000);
  const [bankIdx, setBankIdx] = useState(0);
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refRate, setRefRate] = useState<string>("");

  const country = countries[0];
  const bank = country.banks[bankIdx];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRate(country.currency).then((r) => {
      if (!cancelled) {
        setRate(r);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const received = rate ? Math.max(0, +(amount * rate - bank.fee).toFixed(2)) : null;
  const refRateNum = refRate ? parseFloat(refRate) : null;
  const comparison = compareRates(rate, refRateNum);

  return (
    <div className="max-w-xl mx-auto my-10 p-8 bg-background rounded-lg shadow border" dir="rtl">
      <h2 className="text-2xl font-bold mb-2 text-center">محول العملات - شيكل إلى يورو</h2>
      <p className="text-center mb-6 text-muted-foreground">
        حوّل الشيكل (ILS) إلى اليورو (EUR) مع رسوم البنوك الألمانية.
      </p>
      <form className="space-y-4" onSubmit={e => e.preventDefault()} autoComplete="off">
        <div>
          <label className="block font-semibold mb-1">المبلغ بالشيكل (ILS):</label>
          <input
            type="number"
            value={amount}
            min={1}
            onChange={e => setAmount(Number(e.target.value))}
            className="border px-3 py-2 rounded w-full max-w-xs"
            placeholder="أدخل المبلغ بالشيكل"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">البنك المستلم في ألمانيا:</label>
          <select
            value={bankIdx}
            onChange={e => setBankIdx(Number(e.target.value))}
            className="border px-3 py-2 rounded w-full max-w-xs"
          >
            {country.banks.map((b, i) => (
              <option value={i} key={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">
            سعر صرف مرجعي (اختياري):
          </label>
          <input
            type="number"
            value={refRate}
            min={0}
            step="any"
            onChange={e => setRefRate(e.target.value)}
            className="border px-3 py-2 rounded w-full max-w-xs"
            placeholder={`مثلاً 0.24 لكل 1 شيكل = 0.24 يورو`}
          />
        </div>
      </form>
      <div className="mt-8 p-6 bg-secondary rounded border">
        {loading ? (
          <span>جاري تحميل السعر...</span>
        ) : rate ? (
          <>
            <div>
              <span className="font-semibold">سعر الصرف:</span> 1 شيكل = {rate.toFixed(4)} يورو
            </div>
            <div>
              <span className="font-semibold">رسوم البنك:</span> {bank.fee} يورو
            </div>
            <div className="mt-2 text-lg">
              <span className="font-semibold">ستستلم:</span>{" "}
              <span className="text-green-600 font-bold">{received} يورو</span>
            </div>
            {refRate && (
              <div className="mt-4 text-sm">
                <span className="font-semibold">السعر المرجعي:</span> 1 شيكل = {refRate} يورو<br />
                {comparison && (
                  <span>
                    الفرق:{" "}
                    <span className={
                      comparison.type === "higher"
                        ? "text-green-700"
                        : comparison.type === "lower"
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }>
                      {comparison.type === "same" && "مطابق للمرجعي."}
                      {comparison.type !== "same" &&
                        `${comparison.diff.toFixed(4)} (${comparison.type === "higher" ? "السعر الحالي أعلى" : "السعر الحالي أقل"})`
                      }
                    </span>
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <span className="text-red-500">فشل في جلب سعر الصرف.</span>
        )}
      </div>
    </div>
  );
}