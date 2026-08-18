"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartData, dailyReportKpis } from "@/lib/mock-data";

export function DailyReport() {
  return (
    <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5">
        <h2 className="text-base font-semibold text-zinc-100">
          Relatório Diário
        </h2>
        <span className="text-xs font-medium text-zinc-500">12/05/2025</span>
      </div>

      <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[240px_1fr]">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          {dailyReportKpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-zinc-800/60 bg-zinc-950/50 px-4 py-3"
            >
              <dt className="text-xs text-zinc-500">{kpi.label}</dt>
              <dd className="mt-1 text-lg font-bold text-zinc-50">
                {kpi.value}
              </dd>
              <dd className="text-xs font-medium text-green-400">
                {kpi.delta}
              </dd>
            </div>
          ))}
        </dl>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#facc15" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={[0, 1500]}
                ticks={[0, 500, 1000, 1500]}
                tickFormatter={(value: number) =>
                  value === 0 ? "0" : value >= 1000 ? `${value / 1000}k` : `${value}`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#f4f4f5",
                }}
                labelStyle={{ color: "#a1a1aa" }}
                cursor={{ stroke: "#3f3f46", strokeDasharray: "3 3" }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Faturamento"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#facc15"
                strokeWidth={2.5}
                fill="url(#goldArea)"
                dot={{ fill: "#facc15", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#facc15" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}