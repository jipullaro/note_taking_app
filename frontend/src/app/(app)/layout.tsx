import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/notes/Sidebar";
import { Toaster } from "@/components/ui/Toaster";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(); // redirects to /login if there's no session

  // A column on phones: the sidebar is an off-canvas drawer there, so what
  // sits above `main` in the flow is the bar holding the button that opens it.
  // From md up the sidebar rejoins the flow as the left column.
  return (
    <div className="flex min-h-screen flex-col bg-cream md:flex-row">
      <Sidebar />
      <main className="flex flex-1 flex-col px-5 py-6 md:px-10 md:py-10">{children}</main>
      {/*
        Mounted once here rather than in the root layout: every toast emitter
        lives behind auth, and the login/register pages deliberately report
        their errors inline in the form instead.
      */}
      <Toaster />
    </div>
  );
}
