import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Phone, Mail, Calendar as CalIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/clients/")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <ClientsList />
      </AppShell>
    </RequireAuth>
  ),
});

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  due_date: string | null;
};

function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, phone, email, due_date")
      .order("full_name");
    setClients((data as Client[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = clients.filter((c) =>
    c.full_name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} in your care`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New client
              </Button>
            </DialogTrigger>
            <NewClientDialog onCreated={() => { setOpen(false); load(); }} />
          </Dialog>
        }
      />

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed border bg-transparent p-12 text-center shadow-none">
          <p className="text-muted-foreground">No clients yet. Add your first to get started.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} to="/clients/$id" params={{ id: c.id }}>
              <Card className="group h-full border-none p-5 shadow-soft transition-all hover:shadow-card">
                <div className="font-display text-xl">{c.full_name}</div>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" /> {c.phone}
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.due_date && (
                    <div className="flex items-center gap-2">
                      <CalIcon className="h-3.5 w-3.5" /> Due {format(parseISO(c.due_date), "d MMM yyyy")}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function NewClientDialog({ onCreated }: { onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "", date_of_birth: "", phone: "", email: "", address: "",
    due_date: "", blood_type: "", emergency_contact: "", medical_notes: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setBusy(true);
    const payload: Record<string, string | null> = { full_name: form.full_name.trim() };
    for (const k of ["date_of_birth","phone","email","address","due_date","blood_type","emergency_contact","medical_notes"] as const) {
      payload[k] = form[k].trim() || null;
    }
    const { error } = await supabase.from("clients").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Client added");
    onCreated();
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">New client</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2">
          <Label>Full name *</Label>
          <Input value={form.full_name} onChange={set("full_name")} required />
        </div>
        <div className="space-y-2">
          <Label>Date of birth</Label>
          <Input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
        </div>
        <div className="space-y-2">
          <Label>Due date</Label>
          <Input type="date" value={form.due_date} onChange={set("due_date")} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={set("phone")} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={set("email")} />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={set("address")} />
        </div>
        <div className="space-y-2">
          <Label>Blood type</Label>
          <Input placeholder="e.g. O+" value={form.blood_type} onChange={set("blood_type")} />
        </div>
        <div className="space-y-2">
          <Label>Emergency contact</Label>
          <Input placeholder="Name & phone" value={form.emergency_contact} onChange={set("emergency_contact")} />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Medical notes</Label>
          <Textarea rows={4} value={form.medical_notes} onChange={set("medical_notes")} />
        </div>
        <DialogFooter className="sm:col-span-2">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save client"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
