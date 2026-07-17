import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/Sidebar";
import { BackgroundOrbs } from "@/components/BackgroundOrbs";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="min-h-screen flex w-full">
      <BackgroundOrbs />
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
