-- Tabela para associar escopos (hierarquia) a perfis
CREATE TABLE IF NOT EXISTS public.perfil_escopo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id UUID NOT NULL REFERENCES public.perfil(perfil_id) ON DELETE CASCADE,
    tipo_escopo TEXT NOT NULL CHECK (tipo_escopo IN ('DEPARTAMENTO', 'SETOR', 'PASTA')),
    referencia_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Garantir privilégios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_escopo TO authenticated;
GRANT ALL ON public.perfil_escopo TO service_role;

-- Habilitar RLS
ALTER TABLE public.perfil_escopo ENABLE ROW LEVEL SECURITY;

-- Política de acesso
CREATE POLICY "Users can manage profile scopes within their org" ON public.perfil_escopo
    FOR ALL
    TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
