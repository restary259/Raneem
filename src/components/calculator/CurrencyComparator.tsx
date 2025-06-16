import { useState, useEffect } from "react";

// Country and bank data
const countries = [
  {
    code: "IT",
    name: "Italy",
    currency: "EUR",
    banks: [
      { id: "unicredit", name: "UniCredit", fee: 2 },
      { id: "intesa", name: "Intesa Sanpaolo", fee: 2.5 },
    ],
  },
  {
    code: "DE",
    name: "Germany",
    currency: "EUR",
    banks: [
      { id: "deutsche", name: "Deutsche Bank", fee: 2 },
      { id: "commerz", name: "Commerzbank", fee: 2.5 },
    ],
  },
  {
    code: "RO",
    name: "Romania",
    currency: "RON",
    banks: [
      { id: "bcr", name: "BCR", fee: 5 },
      { id: "brd", name: "BRD", fee: 6 },
    ],
  },
  {
    code: "JO",
    name: "Jordan",
    currency: "JOD",
    banks: [
      { id: "arab", name: "Arab Bank", fee: 1 },
      { id: "housing", name: "Housing Bank", fee: 1.2 },
    ],
  },
];

// API fetch for specific date (update this date every few months for latest rates)
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
  const [countryIdx, setCountryIdx] = useState(0);
  const [bankIdx, setBankIdx] = useState(0);
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refRate, setRefRate] = useState<string>("");

  const country = countries[countryIdx];
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
  }, [countryIdx]);

  useEffect(() => {
    if (bankIdx >= country.banks.length) setBankIdx(0);
  }, [countryIdx, bankIdx, country.banks.length]);

  const received = rate ? Math.max(0, +(amount * rate - bank.fee).toFixed(2)) : null;
  const refRateNum = refRate ? parseFloat(refRate) : null;
  const comparison = compareRates(rate, refRateNum);

  return (
    <div className="max-w-xl mx-auto my-10 p-8 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-2 text-center">ILS Currency Converter</h2>
      <p className="text-center mb-6">
        Convert Shekel (ILS) to EUR (Italy, Germany), JOD (Jordan), RON (Romania) with local bank fees.<br />
        <span className="text-xs text-gray-500">
          Rates as of June 2025. Update the code every few months for latest rates.
        </span>
      </p>
      <form className="space-y-4" onSubmit={e => e.preventDefault()} autoComplete="off">
        <div>
          <label className="block font-semibold mb-1">Amount in Shekel (ILS):</label>
          <input
            type="number"
            value={amount}
            min={1}
            onChange={e => setAmount(Number(e.target.value))}
            className="border px-3 py-2 rounded w-full max-w-xs"
            placeholder="Enter amount in ILS"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Destination Country:</label>
          <select
            value={countryIdx}
            onChange={e => setCountryIdx(Number(e.target.value))}
            className="border px-3 py-2 rounded w-full max-w-xs"
          >
            {countries.map((c, i) => (
              <option value={i} key={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Receiving Bank:</label>
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
            Reference Rate for {country.currency} (optional):
          </label>
          <input
            type="number"
            value={refRate}
            min={0}
            step="any"
            onChange={e => setRefRate(e.target.value)}
            className="border px-3 py-2 rounded w-full max-w-xs"
            placeholder={`e.g. 0.24 for 1 ILS = 0.24 ${country.currency}`}
          />
        </div>
      </form>
      <div className="mt-8 p-6 bg-gray-50 rounded border">
        {loading ? (
          <span>Loading rate...</span>
        ) : rate ? (
          <>
            <div>
              <span className="font-semibold">Exchange Rate:</span> 1 ILS = {rate.toFixed(4)} {country.currency}
            </div>
            <div>
              <span className="font-semibold">Bank Fee:</span> {bank.fee} {country.currency}
            </div>
            <div className="mt-2 text-lg">
              <span className="font-semibold">You Receive:</span>{" "}
              <span className="text-green-600">{received} {country.currency}</span>
            </div>
            {refRate && (
              <div className="mt-4 text-sm">
                <span className="font-semibold">Reference Rate:</span> 1 ILS = {refRate} {country.currency}<br />
                {comparison && (
                  <span>
                    Difference:{" "}
                    <span className={
                      comparison.type === "higher"
                        ? "text-green-700"
                        : comparison.type === "lower"
                        ? "text-red-600"
                        : "text-neutral-600"
                    }>
                      {comparison.type === "same" && "Same as reference."}
                      {comparison.type !== "same" &&
                        `${comparison.diff.toFixed(4)} (${comparison.type === "higher" ? "Current rate is higher" : "Current rate is lower"})`
                      }
                    </span>
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <span className="text-red-500">Failed to fetch exchange rate.</span>
        )}
      </div>
    </div>
  );
}
