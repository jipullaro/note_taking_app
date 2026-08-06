import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/notes/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(); // redirects to /login if there's no session

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="flex flex-1 flex-col px-10 py-10">{children}</main>
    </div>
  );
}
