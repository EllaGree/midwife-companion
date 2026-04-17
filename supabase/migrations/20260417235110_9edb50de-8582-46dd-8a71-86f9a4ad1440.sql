CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  phone TEXT,
  email TEXT,
  address TEXT,
  due_date DATE,
  blood_type TEXT,
  emergency_contact TEXT,
  medical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete clients" ON public.clients FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 45,
  type TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_client ON public.appointments(client_id);
CREATE INDEX idx_appointments_time ON public.appointments(scheduled_at);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view appts" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert appts" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update appts" ON public.appointments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete appts" ON public.appointments FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_appts_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.prenatal_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  blood_pressure TEXT,
  weight_kg NUMERIC(5,2),
  fundal_height_cm NUMERIC(5,2),
  fetal_heart_rate INT,
  gestational_age_weeks NUMERIC(4,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visits_client ON public.prenatal_visits(client_id);
ALTER TABLE public.prenatal_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view visits" ON public.prenatal_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert visits" ON public.prenatal_visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update visits" ON public.prenatal_visits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete visits" ON public.prenatal_visits FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_visits_updated BEFORE UPDATE ON public.prenatal_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.birth_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.birth_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view bp" ON public.birth_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert bp" ON public.birth_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update bp" ON public.birth_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete bp" ON public.birth_plans FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_bp_updated BEFORE UPDATE ON public.birth_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  doc_type TEXT NOT NULL DEFAULT 'other',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_client ON public.documents(client_id);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view docs" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert docs" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update docs" ON public.documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete docs" ON public.documents FOR DELETE TO authenticated USING (true);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outgoing','incoming')),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_client ON public.messages(client_id, created_at DESC);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view msgs" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert msgs" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update msgs" ON public.messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete msgs" ON public.messages FOR DELETE TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read client docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'client-documents');
CREATE POLICY "auth upload client docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-documents');
CREATE POLICY "auth update client docs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'client-documents');
CREATE POLICY "auth delete client docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'client-documents');