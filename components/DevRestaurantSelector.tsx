"use client";

import { fetchRestaurants } from "@/services/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const sampleRestaurants = [
  { id: "demo-restaurant", name: "Demo Restaurant", defaultTable: "table-7" },
  { id: "pasta-house", name: "Pasta House", defaultTable: "table-1" },
  { id: "sushi-bar", name: "Sushi Bar", defaultTable: "table-3" }
];

export function DevRestaurantSelector() {
  const router = useRouter();
  const [options, setOptions] = useState(sampleRestaurants);
  const [selected, setSelected] = useState(sampleRestaurants[0]);
  const [table, setTable] = useState(sampleRestaurants[0].defaultTable);
  const [show, setShow] = useState(false);
  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

  const isDev = useMemo(() => process.env.NODE_ENV === "development", []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isDev && isLocalhost) {
      setShow(true);
      // hydrate with real restaurants (public endpoint or protected if token)
      fetchRestaurants()
        .then((res) => {
          if (res.restaurants?.length) {
            const mapped = res.restaurants.map((r) => ({
              id: String(r.id),
              name: r.name,
              defaultTable: "table-1"
            }));
            setOptions(mapped);
            setSelected(mapped[0]);
            setTable(mapped[0].defaultTable);
          }
        })
        .catch(() => {
          // fallback to sample list if auth/api not ready
        });
    }
  }, [isDev, apiToken]);

  if (!show) return null;

  return (
    <div className="mt-6 p-4 border border-dashed border-black/10 rounded-2xl text-left bg-white/70">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-ink">Dev mode quick jump</p>
        <span className="text-xs uppercase bg-ink/5 px-2 py-1 rounded-full">Localhost</span>
      </div>
      <p className="text-sm text-ink/60 mb-3">
        Select a restaurant/table to simulate scanning a QR. Only visible in development on
        localhost.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          className="flex-1 rounded-xl border border-black/10 px-3 py-2 bg-white/80"
          value={selected.id}
          onChange={(e) => {
            const next = options.find((r) => r.id === e.target.value);
            if (next) {
              setSelected(next);
              setTable(next.defaultTable);
            }
          }}
        >
          {options.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.id})
            </option>
          ))}
        </select>
        <input
          className="sm:w-40 rounded-xl border border-black/10 px-3 py-2 bg-white/80"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          placeholder="table-7"
        />
        <button
          className="sm:w-auto w-full px-4 py-2 rounded-xl bg-brand text-white font-semibold shadow-lg shadow-brand/30"
          onClick={() => router.push(`/r/${selected.id}/${table || selected.defaultTable}`)}
        >
          Go
        </button>
      </div>
    </div>
  );
}
