import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/notes/Sidebar";
import { Toaster } from "@/components/ui/Toaster";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(); // redirects to /login if there's no session

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="flex flex-1 flex-col px-10 py-10">{children}</main>
      {/*
        Mounted once here rather than in the root layout: every toast emitter
        lives behind auth, and the login/register pages deliberately report
        their errors inline in the form instead.
      */}
      <Toaster />
    </div>
  );
}
