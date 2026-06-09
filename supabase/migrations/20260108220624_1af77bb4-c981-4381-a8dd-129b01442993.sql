-- ==============================================
-- NEXO WORKTIME - DATABASE SCHEMA
-- ==============================================

-- Enum for time entry status
CREATE TYPE public.time_entry_status AS ENUM ('pending', 'approved', 'rejected');

-- Enum for project status
CREATE TYPE public.project_status AS ENUM ('active', 'completed', 'on_hold', 'cancelled');

-- ==============================================
-- PROJECTS TABLE
-- ==============================================
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status public.project_status NOT NULL DEFAULT 'active',
  budget_hours INTEGER,
  hourly_rate DECIMAL(10,2),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "SuperAdmins podem gerenciar todos os projetos"
ON public.projects FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver projetos da sua organização"
ON public.projects FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar projetos"
ON public.projects FOR INSERT
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar projetos"
ON public.projects FOR UPDATE
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar projetos"
ON public.projects FOR DELETE
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- ==============================================
-- ACTIVITIES TABLE (Tasks within projects)
-- ==============================================
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on activities
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activities
CREATE POLICY "SuperAdmins podem gerenciar todas as atividades"
ON public.activities FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver atividades da sua organização"
ON public.activities FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "OrgAdmins podem criar atividades"
ON public.activities FOR INSERT
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem atualizar atividades"
ON public.activities FOR UPDATE
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "OrgAdmins podem deletar atividades"
ON public.activities FOR DELETE
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- ==============================================
-- TIME ENTRIES TABLE
-- ==============================================
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  description TEXT,
  status public.time_entry_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on time_entries
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for time_entries
CREATE POLICY "SuperAdmins podem gerenciar todos os registros"
ON public.time_entries FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Usuários podem ver seus próprios registros"
ON public.time_entries FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "OrgAdmins podem ver registros da organização"
ON public.time_entries FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Usuários podem criar seus próprios registros"
ON public.time_entries FOR INSERT
WITH CHECK (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Usuários podem atualizar registros pendentes próprios"
ON public.time_entries FOR UPDATE
USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "OrgAdmins podem atualizar registros da organização"
ON public.time_entries FOR UPDATE
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

CREATE POLICY "Usuários podem deletar registros pendentes próprios"
ON public.time_entries FOR DELETE
USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "OrgAdmins podem deletar registros da organização"
ON public.time_entries FOR DELETE
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'org_admin'::app_role));

-- ==============================================
-- INDEXES
-- ==============================================
CREATE INDEX idx_projects_organization ON public.projects(organization_id);
CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status);

CREATE INDEX idx_activities_organization ON public.activities(organization_id);
CREATE INDEX idx_activities_project ON public.activities(project_id);

CREATE INDEX idx_time_entries_organization ON public.time_entries(organization_id);
CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_project ON public.time_entries(project_id);
CREATE INDEX idx_time_entries_date ON public.time_entries(date);
CREATE INDEX idx_time_entries_status ON public.time_entries(status);

-- ==============================================
-- TRIGGERS FOR UPDATED_AT
-- ==============================================
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();