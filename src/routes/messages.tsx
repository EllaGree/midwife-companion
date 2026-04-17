import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Send, Inbox } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <MessagesPage />
      </AppShell>
    </RequireAuth>
  ),
});

type ClientLite = { id: string; full_name: string };
type Message = {
  id: string;
  client_id: string;
  direction: "incoming" | "outgoing";
  body: string;
  read_at: string | null;
  created_at: string;
};
type Thread = { client: ClientLite; last: Message; unread: number };

function MessagesPage() {
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [allMsgs, setAllMsgs] = useState<Message[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = async () => {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("messages").select("*").order("created_at"),
    ]);
    setClients((c as ClientLite[]) ?? []);
    setAllMsgs((m as Message[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  // Mark incoming as read when opening thread
  useEffect(() => {
    if (!activeId) return;
    const unread = allMsgs.filter((m) => m.client_id === activeId && m.direction === "incoming" && !m.read_at).map((m) => m.id);
    if (unread.length === 0) return;
    supabase.from("messages").update({ read_at: new Date().toISOString() } as never).in("id", unread).then(() => load());
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const threads: Thread[] = clients
    .map((c) => {
      const msgs = allMsgs.filter((m) => m.client_id === c.id);
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter((m) => m.direction === "incoming" && !m.read_at).length;
      return last ? { client: c, last, unread } : null;
    })
    .filter((t): t is Thread => t !== null)
    .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));

  const activeMsgs = activeId ? allMsgs.filter((m) => m.client_id === activeId) : [];
  const activeClient = clients.find((c) => c.id === activeId);

  return (
    <>
      <PageHeader title="Messages" subtitle="Internal client correspondence" />

      <Card className="border-none p-0 shadow-soft overflow-hidden">
        <div className="grid h-[calc(100vh-16rem)] min-h-[480px] grid-cols-1 md:grid-cols-[300px_1fr]">
          {/* Thread list */}
          <div className="border-r overflow-y-auto">
            <NewThreadBar clients={clients} onCreated={(cid) => { setActiveId(cid); load(); }} />
            {threads.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Inbox className="mx-auto mb-2 h-6 w-6" />
                No messages yet.
              </div>
            ) : (
              <ul>
                {threads.map((t) => (
                  <li key={t.client.id}>
                    <button
                      onClick={() => setActiveId(t.client.id)}
                      className={[
                        "w-full px-4 py-3 text-left transition-colors border-l-2",
                        activeId === t.client.id
                          ? "bg-primary-soft/40 border-l-primary"
                          : "border-l-transparent hover:bg-accent/40",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate">{t.client.full_name}</div>
                        {t.unread > 0 && (
                          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1.5 text-xs text-white">
                            {t.unread}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.last.body}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground/70">{formatDistanceToNow(parseISO(t.last.created_at), { addSuffix: true })}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active thread */}
          <div className="flex flex-col">
            {!activeClient ? (
              <div className="m-auto text-center text-muted-foreground">
                <Inbox className="mx-auto mb-3 h-8 w-8" />
                <p className="text-sm">Select a conversation</p>
              </div>
            ) : (
              <ThreadView client={activeClient} msgs={activeMsgs} onSent={load} />
            )}
          </div>
        </div>
      </Card>
    </>
  );
}

function NewThreadBar({ clients, onCreated }: { clients: ClientLite[]; onCreated: (cid: string) => void }) {
  const [val, setVal] = useState<string>("");
  return (
    <div className="border-b p-3">
      <Select
        value={val}
        onValueChange={(v) => { setVal(""); onCreated(v); }}
      >
        <SelectTrigger className="w-full"><SelectValue placeholder="Start conversation…" /></SelectTrigger>
        <SelectContent>
          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ThreadView({ client, msgs, onSent }: { client: ClientLite; msgs: Message[]; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const txt = body.trim();
    if (!txt) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({
      client_id: client.id,
      direction,
      body: txt,
      read_at: direction === "outgoing" ? new Date().toISOString() : null,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    onSent();
  };

  return (
    <>
      <div className="border-b px-5 py-4">
        <div className="font-display text-xl">{client.full_name}</div>
        <div className="text-xs text-muted-foreground">{msgs.length} message{msgs.length === 1 ? "" : "s"}</div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground">No messages yet.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={["flex", m.direction === "outgoing" ? "justify-end" : "justify-start"].join(" ")}>
            <div
              className={[
                "max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-soft",
                m.direction === "outgoing"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-secondary-foreground rounded-bl-sm",
              ].join(" ")}
            >
              <div className="whitespace-pre-wrap">{m.body}</div>
              <div className={[
                "mt-1 text-[10px] opacity-70",
                m.direction === "outgoing" ? "text-primary-foreground" : "text-muted-foreground",
              ].join(" ")}>
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
          <Textarea
            rows={2}
            placeholder={direction === "outgoing" ? "Type a message…" : "Paste / type the message you received…"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="resize-none"
          />
          <Button type="submit" disabled={busy} size="icon" className="h-auto"><Send className="h-4 w-4" /></Button>
        </div>
      </form>
    </>
  );
}
