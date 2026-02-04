"use client";

import { fetchRestaurants } from "@/services/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const sampleRestaurants = [
  { id: "demo-restaurant", name: "Demo Restaurant", defaultTable: "7" },
  { id: "pasta-house", name: "Pasta House", defaultTable: "1" },
  { id: "sushi-bar", name: "Sushi Bar", defaultTable: "3" }
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
              defaultTable: "1"
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
    <div className="mt-6 p-4 border border-dashed border-light-divider rounded-card text-left bg-light-subtle">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-ink">Dev mode quick jump</p>
        <span className="text-xs uppercase bg-brand/10 text-brand px-2 py-1 rounded-chip font-semibold">Localhost</span>
      </div>
      <p className="text-sm text-ink-muted mb-3">
        Select a restaurant/table to simulate scanning a QR. Only visible in development on
        localhost.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          className="flex-1 rounded-standard border border-light-divider px-medium py-small bg-light-surface focus:outline-none focus:ring-2 focus:ring-brand"
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
          className="sm:w-40 rounded-standard border border-light-divider px-medium py-small bg-light-surface focus:outline-none focus:ring-2 focus:ring-brand"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          placeholder="7"
        />
        <button
          className="sm:w-auto w-full px-medium py-small rounded-button bg-brand text-white font-bold shadow-lg shadow-brand/30 hover:bg-brand-dark transition"
          onClick={() => router.push(`/r/${selected.id}/${table || selected.defaultTable}`)}
        >
          Go
        </button>
      </div>
    </div>
  );
}
