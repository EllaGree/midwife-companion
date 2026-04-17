import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  addMonths, addDays, format, isSameDay, isSameMonth, parseISO,
  startOfMonth, startOfWeek, endOfMonth, endOfWeek,
} from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/calendar")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <CalendarPage />
      </AppShell>
    </RequireAuth>
  ),
});

type Appt = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: string;
  notes: string | null;
  client_id: string;
  clients: { full_name: string } | null;
};
type ClientLite = { id: string; full_name: string };

const TYPES = ["Prenatal visit", "Birth plan review", "Postnatal visit", "Initial consult", "Home visit", "Other"];

function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [appts, setAppts] = useState<Appt[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(() => {
    const out: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) { out.push(d); d = addDays(d, 1); }
    return out;
  }, [gridStart, gridEnd]);

  const load = async () => {
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, type, notes, client_id, clients(full_name)")
        .gte("scheduled_at", gridStart.toISOString())
        .lte("scheduled_at", gridEnd.toISOString())
        .order("scheduled_at"),
      supabase.from("clients").select("id, full_name").order("full_name"),
    ]);
    setAppts((a as Appt[]) ?? []);
    setClients((c as ClientLite[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cursor.getTime()]);

  const apptsForDay = (d: Date) => appts.filter((a) => isSameDay(parseISO(a.scheduled_at), d));
  const dayAppts = apptsForDay(selectedDay);

  const cancel = async (id: string) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Appointment cancelled");
    load();
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={format(cursor, "MMMM yyyy")}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New appointment</Button>
            </DialogTrigger>
            <NewAppointmentDialog
              defaultDate={selectedDay}
              clients={clients}
              onCreated={() => { setOpen(false); load(); }}
            />
          </Dialog>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="border-none p-4 shadow-soft sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-display text-xl">{format(cursor, "MMMM yyyy")}</div>
            <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wider text-muted-foreground">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = isSameMonth(d, cursor);
              const isSel = isSameDay(d, selectedDay);
              const isToday = isSameDay(d, new Date());
              const count = apptsForDay(d).length;
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDay(d)}
                  className={[
                    "relative aspect-square rounded-lg p-1 text-left transition-colors",
                    inMonth ? "" : "opacity-40",
                    isSel ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  ].join(" ")}
                >
                  <div className={["text-sm", isToday && !isSel ? "font-bold text-primary" : ""].join(" ")}>
                    {format(d, "d")}
                  </div>
                  {count > 0 && (
                    <div className={[
                      "absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full",
                      isSel ? "bg-primary-foreground" : "bg-primary",
                    ].join(" ")} />
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="border-none p-6 shadow-soft">
          <div className="mb-4">
            <div className="font-display text-2xl">{format(selectedDay, "EEEE")}</div>
            <div className="text-sm text-muted-foreground">{format(selectedDay, "d MMMM yyyy")}</div>
          </div>
          {dayAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {dayAppts.map((a) => (
                <li key={a.id} className="rounded-lg border bg-secondary/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-mono text-sm">{format(parseISO(a.scheduled_at), "HH:mm")} · {a.duration_minutes}m</div>
                      <div className="font-medium">{a.clients?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{a.type}</div>
                      {a.notes && <div className="mt-1 text-xs text-muted-foreground">{a.notes}</div>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => cancel(a.id)} aria-label="Cancel">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function NewAppointmentDialog({
  defaultDate,
  clients,
  onCreated,
}: {
  defaultDate: Date;
  clients: ClientLite[];
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [date, setDate] = useState(format(defaultDate, "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("45");
  const [type, setType] = useState(TYPES[0]);
  const [notes, setNotes] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast.error("Choose a client"); return; }
    setBusy(true);
    const scheduled = new Date(`${date}T${time}:00`);
    const { error } = await supabase.from("appointments").insert({
      client_id: clientId,
      scheduled_at: scheduled.toISOString(),
      duration_minutes: Number(duration),
      type,
      notes: notes.trim() || null,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment booked");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-2xl">New appointment</DialogTitle></DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Duration (min)</Label>
            <Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Booking…" : "Book appointment"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
