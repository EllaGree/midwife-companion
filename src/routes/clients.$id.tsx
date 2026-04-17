import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Plus, Save, Upload, FileText, Image as ImageIcon, Download, Trash2, Send } from "lucide-react";
import { format, parseISO, differenceInYears } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/clients/$id")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <ClientDetail />
      </AppShell>
    </RequireAuth>
  ),
});

type Client = {
  id: string; full_name: string; date_of_birth: string | null; phone: string | null;
  email: string | null; address: string | null; due_date: string | null;
  blood_type: string | null; emergency_contact: string | null; medical_notes: string | null;
};
type Visit = {
  id: string; visit_date: string; blood_pressure: string | null; weight_kg: number | null;
  fundal_height_cm: number | null; fetal_heart_rate: number | null;
  gestational_age_weeks: number | null; notes: string | null;
};
type Doc = {
  id: string; storage_path: string; file_name: string; mime_type: string | null;
  doc_type: string; size_bytes: number | null; uploaded_at: string;
};
type Msg = { id: string; direction: "incoming" | "outgoing"; body: string; created_at: string; read_at: string | null };

const DOC_TYPES = ["Ultrasound", "Lab result", "ID document", "Consent", "Other"];

function ClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    supabase.from("clients").select("*").eq("id", id).single().then(({ data }) => setClient(data as Client | null));
  }, [id]);

  if (!client) return <div className="text-muted-foreground">Loading…</div>;

  const age = client.date_of_birth ? differenceInYears(new Date(), parseISO(client.date_of_birth)) : null;

  return (
    <>
      <Link to="/clients" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All clients
      </Link>

      <PageHeader
        title={client.full_name}
        subtitle={[
          age !== null ? `${age} yrs` : null,
          client.due_date ? `Due ${format(parseISO(client.due_date), "d MMM yyyy")}` : null,
          client.blood_type ? `${client.blood_type}` : null,
        ].filter(Boolean).join(" · ")}
        action={
          <Button
            variant="outline"
            onClick={async () => {
              if (!confirm("Delete this client and all their records?")) return;
              const { error } = await supabase.from("clients").delete().eq("id", id);
              if (error) return toast.error(error.message);
              toast.success("Client deleted");
              navigate({ to: "/clients" });
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        }
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 flex w-full flex-wrap gap-1 bg-secondary/60">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="birth">Birth plan</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><Overview client={client} onUpdated={(c) => setClient(c)} /></TabsContent>
        <TabsContent value="visits"><Visits clientId={id} /></TabsContent>
        <TabsContent value="birth"><BirthPlan clientId={id} /></TabsContent>
        <TabsContent value="docs"><Documents clientId={id} /></TabsContent>
        <TabsContent value="messages"><MessagesTab clientId={id} /></TabsContent>
      </Tabs>
    </>
  );
}

/* ---------- Overview ---------- */
function Overview({ client, onUpdated }: { client: Client; onUpdated: (c: Client) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Client>(client);
  const set = (k: keyof Client) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    const { data, error } = await supabase.from("clients").update({
      full_name: form.full_name,
      date_of_birth: form.date_of_birth || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      due_date: form.due_date || null,
      blood_type: form.blood_type || null,
      emergency_contact: form.emergency_contact || null,
      medical_notes: form.medical_notes || null,
    } as never).eq("id", client.id).select().single();
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(false);
    onUpdated(data as Client);
  };

  if (!editing) {
    const Field = ({ label, value }: { label: string; value: string | null }) => (
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm">{value || <span className="text-muted-foreground">—</span>}</div>
      </div>
    );
    return (
      <Card className="border-none p-6 shadow-soft">
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => { setForm(client); setEditing(true); }}>Edit</Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date of birth" value={client.date_of_birth ? format(parseISO(client.date_of_birth), "d MMM yyyy") : null} />
          <Field label="Due date" value={client.due_date ? format(parseISO(client.due_date), "d MMM yyyy") : null} />
          <Field label="Phone" value={client.phone} />
          <Field label="Email" value={client.email} />
          <Field label="Blood type" value={client.blood_type} />
          <Field label="Emergency contact" value={client.emergency_contact} />
          <div className="sm:col-span-2"><Field label="Address" value={client.address} /></div>
          <div className="sm:col-span-2"><Field label="Medical notes" value={client.medical_notes} /></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-none p-6 shadow-soft">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={set("full_name")} /></div>
        <div className="space-y-2"><Label>Date of birth</Label><Input type="date" value={form.date_of_birth ?? ""} onChange={set("date_of_birth")} /></div>
        <div className="space-y-2"><Label>Due date</Label><Input type="date" value={form.due_date ?? ""} onChange={set("due_date")} /></div>
        <div className="space-y-2"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={set("phone")} /></div>
        <div className="space-y-2"><Label>Email</Label><Input value={form.email ?? ""} onChange={set("email")} /></div>
        <div className="space-y-2"><Label>Blood type</Label><Input value={form.blood_type ?? ""} onChange={set("blood_type")} /></div>
        <div className="space-y-2"><Label>Emergency contact</Label><Input value={form.emergency_contact ?? ""} onChange={set("emergency_contact")} /></div>
        <div className="sm:col-span-2 space-y-2"><Label>Address</Label><Input value={form.address ?? ""} onChange={set("address")} /></div>
        <div className="sm:col-span-2 space-y-2"><Label>Medical notes</Label><Textarea rows={4} value={form.medical_notes ?? ""} onChange={set("medical_notes")} /></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        <Button onClick={save}><Save className="mr-2 h-4 w-4" /> Save</Button>
      </div>
    </Card>
  );
}

/* ---------- Visits ---------- */
function Visits({ clientId }: { clientId: string }) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [open, setOpen] = useState(false);
  const load = async () => {
    const { data } = await supabase.from("prenatal_visits").select("*").eq("client_id", clientId).order("visit_date", { ascending: false });
    setVisits((data as Visit[]) ?? []);
  };
  useEffect(() => { load(); }, [clientId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New visit</Button></DialogTrigger>
          <NewVisitDialog clientId={clientId} onCreated={() => { setOpen(false); load(); }} />
        </Dialog>
      </div>

      {visits.length === 0 ? (
        <Card className="border-dashed bg-transparent p-12 text-center shadow-none"><p className="text-muted-foreground">No visits logged yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => (
            <Card key={v.id} className="border-none p-5 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-display text-lg">{format(parseISO(v.visit_date), "d MMMM yyyy")}</div>
                {v.gestational_age_weeks && (
                  <div className="rounded-full bg-primary-soft px-3 py-0.5 text-xs text-primary">
                    {v.gestational_age_weeks} weeks
                  </div>
                )}
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <Stat label="BP" value={v.blood_pressure} />
                <Stat label="Weight" value={v.weight_kg ? `${v.weight_kg} kg` : null} />
                <Stat label="Fundal" value={v.fundal_height_cm ? `${v.fundal_height_cm} cm` : null} />
                <Stat label="FHR" value={v.fetal_heart_rate ? `${v.fetal_heart_rate} bpm` : null} />
              </div>
              {v.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{v.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value ?? "—"}</div>
    </div>
  );
}

function NewVisitDialog({ clientId, onCreated }: { clientId: string; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    visit_date: format(new Date(), "yyyy-MM-dd"),
    blood_pressure: "", weight_kg: "", fundal_height_cm: "",
    fetal_heart_rate: "", gestational_age_weeks: "", notes: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("prenatal_visits").insert({
      client_id: clientId,
      visit_date: form.visit_date,
      blood_pressure: form.blood_pressure || null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      fundal_height_cm: form.fundal_height_cm ? Number(form.fundal_height_cm) : null,
      fetal_heart_rate: form.fetal_heart_rate ? Number(form.fetal_heart_rate) : null,
      gestational_age_weeks: form.gestational_age_weeks ? Number(form.gestational_age_weeks) : null,
      notes: form.notes || null,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Visit logged");
    onCreated();
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle className="font-display text-2xl">New prenatal visit</DialogTitle></DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2"><Label>Visit date</Label><Input type="date" value={form.visit_date} onChange={set("visit_date")} required /></div>
        <div className="space-y-2"><Label>Gestational age (wks)</Label><Input type="number" step="0.1" value={form.gestational_age_weeks} onChange={set("gestational_age_weeks")} /></div>
        <div className="space-y-2"><Label>Blood pressure</Label><Input placeholder="e.g. 120/80" value={form.blood_pressure} onChange={set("blood_pressure")} /></div>
        <div className="space-y-2"><Label>Weight (kg)</Label><Input type="number" step="0.1" value={form.weight_kg} onChange={set("weight_kg")} /></div>
        <div className="space-y-2"><Label>Fundal height (cm)</Label><Input type="number" step="0.1" value={form.fundal_height_cm} onChange={set("fundal_height_cm")} /></div>
        <div className="space-y-2"><Label>Fetal heart rate (bpm)</Label><Input type="number" value={form.fetal_heart_rate} onChange={set("fetal_heart_rate")} /></div>
        <div className="sm:col-span-2 space-y-2"><Label>Notes</Label><Textarea rows={4} value={form.notes} onChange={set("notes")} /></div>
        <DialogFooter className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save visit"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ---------- Birth plan ---------- */
function BirthPlan({ clientId }: { clientId: string }) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("birth_plans").select("content").eq("client_id", clientId).maybeSingle().then(({ data }) => {
      setContent((data as { content: string } | null)?.content ?? "");
      setLoaded(true);
    });
  }, [clientId]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("birth_plans").upsert({ client_id: clientId, content } as never, { onConflict: "client_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Birth plan saved");
  };

  if (!loaded) return null;
  return (
    <Card className="border-none p-6 shadow-soft">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-2xl">Birth plan</h2>
        <Button onClick={save} disabled={busy}><Save className="mr-2 h-4 w-4" /> {busy ? "Saving…" : "Save"}</Button>
      </div>
      <Textarea
        rows={18}
        placeholder="Preferences for environment, support people, pain management, interventions, postnatal care…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="font-sans"
      />
    </Card>
  );
}

/* ---------- Documents ---------- */
function Documents({ clientId }: { clientId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState(DOC_TYPES[0]);

  const load = async () => {
    const { data } = await supabase.from("documents").select("*").eq("client_id", clientId).order("uploaded_at", { ascending: false });
    setDocs((data as Doc[]) ?? []);
  };
  useEffect(() => { load(); }, [clientId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${clientId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error: insErr } = await supabase.from("documents").insert({
      client_id: clientId, storage_path: path, file_name: file.name,
      mime_type: file.type, size_bytes: file.size, doc_type: docType,
    } as never);
    setUploading(false);
    e.target.value = "";
    if (insErr) return toast.error(insErr.message);
    toast.success("Uploaded");
    load();
  };

  const open = async (d: Doc) => {
    const { data } = await supabase.storage.from("client-documents").createSignedUrl(d.storage_path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Delete ${d.file_name}?`)) return;
    await supabase.storage.from("client-documents").remove([d.storage_path]);
    await supabase.from("documents").delete().eq("id", d.id);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="border-none p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2 sm:w-56">
            <Label>Document type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="mb-2 block">File (PDF or image)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed bg-secondary/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary">
              <Upload className="h-4 w-4" />
              <span>{uploading ? "Uploading…" : "Choose file to upload"}</span>
              <input type="file" className="hidden" accept="application/pdf,image/*" onChange={onUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      </Card>

      {docs.length === 0 ? (
        <Card className="border-dashed bg-transparent p-12 text-center shadow-none"><p className="text-muted-foreground">No documents uploaded.</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => {
            const isImg = d.mime_type?.startsWith("image/");
            return (
              <Card key={d.id} className="border-none p-4 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    {isImg ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.file_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.doc_type} · {format(parseISO(d.uploaded_at), "d MMM yyyy")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => open(d)}><Download className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Per-client messages ---------- */
function MessagesTab({ clientId }: { clientId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("messages").select("*").eq("client_id", clientId).order("created_at");
    setMsgs((data as Msg[]) ?? []);
    // Mark incoming as read
    const unread = (data as Msg[] | null)?.filter((m) => m.direction === "incoming" && !m.read_at).map((m) => m.id) ?? [];
    if (unread.length) await supabase.from("messages").update({ read_at: new Date().toISOString() } as never).in("id", unread);
  };
  useEffect(() => { load(); }, [clientId]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const txt = body.trim();
    if (!txt) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({
      client_id: clientId, direction, body: txt,
      read_at: direction === "outgoing" ? new Date().toISOString() : null,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    load();
  };

  return (
    <Card className="border-none p-0 shadow-soft overflow-hidden">
      <div className="flex h-[60vh] min-h-[400px] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {msgs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No messages yet.</p>
          ) : msgs.map((m) => (
            <div key={m.id} className={["flex", m.direction === "outgoing" ? "justify-end" : "justify-start"].join(" ")}>
              <div className={[
                "max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-soft",
                m.direction === "outgoing"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-secondary-foreground rounded-bl-sm",
              ].join(" ")}>
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className={["mt-1 text-[10px] opacity-70", m.direction === "outgoing" ? "text-primary-foreground" : "text-muted-foreground"].join(" ")}>
                  {format(parseISO(m.created_at), "d MMM HH:mm")}
                </div>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="border-t p-3">
          <div className="mb-2 flex gap-2 text-xs">
            <button type="button" onClick={() => setDirection("outgoing")}
              className={["rounded-full px-3 py-1", direction === "outgoing" ? "bg-primary text-primary-foreground" : "bg-secondary"].join(" ")}>
              Send to client
            </button>
            <button type="button" onClick={() => setDirection("incoming")}
              className={["rounded-full px-3 py-1", direction === "incoming" ? "bg-clay text-white" : "bg-secondary"].join(" ")}>
              Log received
            </button>
          </div>
          <div className="flex gap-2">
            <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} className="resize-none"
              placeholder={direction === "outgoing" ? "Type a message…" : "Paste / type the message you received…"} />
            <Button type="submit" disabled={busy} size="icon" className="h-auto"><Send className="h-4 w-4" /></Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
