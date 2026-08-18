import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { CriticalStock } from "@/components/dashboard/CriticalStock";
import { InventoryControl } from "@/components/dashboard/InventoryControl";
import { RecentEntries } from "@/components/dashboard/RecentEntries";
import { RpaRoutines } from "@/components/dashboard/RpaRoutines";
import { DailyReport } from "@/components/dashboard/DailyReport";

import { kpiCards } from "@/lib/kpi-data";

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Header />

        <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-6 pb-8">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {kpiCards.map((kpi) => (
              <KpiCard key={kpi.title} {...kpi} />
            ))}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <RecentOrders />
            </div>
            <div className="xl:col-span-4">
              <CriticalStock />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <InventoryControl />
            </div>
            <div className="xl:col-span-4">
              <RecentEntries />
            </div>
            <div className="xl:col-span-4">
              <RpaRoutines />
            </div>
          </section>

          <section>
            <DailyReport />
          </section>
        </div>
      </main>
    </div>
  );
}