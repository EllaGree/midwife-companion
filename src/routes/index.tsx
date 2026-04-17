import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar, Users, MessageSquare, Baby } from "lucide-react";
import { format, isToday, isThisWeek, parseISO, differenceInWeeks } from "date-fns";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <Dashboard />
      </AppShell>
    </RequireAuth>
  ),
});

type Appt = { id: string; scheduled_at: string; type: string; clients: { id: string; full_name: string } | null };
type Client = { id: string; full_name: string; due_date: string | null };

function Dashboard() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAhead = new Date();
      weekAhead.setDate(weekAhead.getDate() + 14);

      const [{ data: a }, { data: c }, { count }] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, scheduled_at, type, clients(id, full_name)")
          .gte("scheduled_at", today.toISOString())
          .lte("scheduled_at", weekAhead.toISOString())
          .order("scheduled_at"),
        supabase.from("clients").select("id, full_name, due_date"),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("direction", "incoming")
          .is("read_at", null),
      ]);
      setAppts((a as Appt[]) ?? []);
      setClients((c as Client[]) ?? []);
      setUnread(count ?? 0);
    })();
  }, []);

  const todayAppts = appts.filter((a) => isToday(parseISO(a.scheduled_at)));
  const weekAppts = appts.filter((a) => isThisWeek(parseISO(a.scheduled_at), { weekStartsOn: 1 }));

  const upcomingDue = clients
    .filter((c) => c.due_date)
    .map((c) => ({ ...c, due: parseISO(c.due_date!) }))
    .sort((a, b) => a.due.getTime() - b.due.getTime())
    .slice(0, 5);

  const stats = [
    { label: "Active clients", value: clients.length, icon: Users, accent: "primary" as const },
    { label: "This week", value: weekAppts.length, icon: Calendar, accent: "primary" as const },
    { label: "Unread messages", value: unread, icon: MessageSquare, accent: "clay" as const },
    {
      label: "Due soon",
      value: clients.filter((c) => c.due_date && parseISO(c.due_date) >= new Date() && differenceInWeeks(parseISO(c.due_date), new Date()) <= 4).length,
      icon: Baby,
      accent: "clay" as const,
    },
  ];

  return (
    <>
      <PageHeader
        title="Good day"
        subtitle={format(new Date(), "EEEE, d MMMM yyyy")}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-none bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-2 font-display text-3xl">{s.value}</div>
              </div>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    s.accent === "clay" ? "color-mix(in oklab, var(--clay) 18%, transparent)" : "var(--primary-soft)",
                  color: s.accent === "clay" ? "var(--clay)" : "var(--primary)",
                }}
              >
                <s.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="border-none p-6 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Today's schedule</h2>
            <Link to="/calendar" className="text-sm text-primary hover:underline">View calendar →</Link>
          </div>
          {todayAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments today. Enjoy the calm.</p>
          ) : (
            <ul className="divide-y">
              {todayAppts.map((a) => (
                <li key={a.id} className="flex items-center gap-4 py-3">
                  <div className="w-16 text-right font-mono text-sm text-muted-foreground">
                    {format(parseISO(a.scheduled_at), "HH:mm")}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{a.clients?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{a.type}</div>
                  </div>
                  {a.clients && (
                    <Link to="/clients/$id" params={{ id: a.clients.id }} className="text-xs text-primary hover:underline">
                      Open
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="border-none p-6 shadow-soft">
          <h2 className="mb-4 font-display text-2xl">Next due dates</h2>
          {upcomingDue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No due dates recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingDue.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <Link to="/clients/$id" params={{ id: c.id }} className="hover:underline">
                    {c.full_name}
                  </Link>
                  <span className="text-muted-foreground">{format(c.due, "d MMM")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
