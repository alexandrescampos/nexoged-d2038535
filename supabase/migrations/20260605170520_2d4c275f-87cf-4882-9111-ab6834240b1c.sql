-- Table for support chat logs
CREATE TABLE public.support_chat_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    cnpj_id UUID REFERENCES public.organization_cnpjs(id) ON DELETE SET NULL,
    user_role TEXT,
    user_name TEXT,
    user_question TEXT NOT NULL,
    assistant_response TEXT,
    category TEXT,
    model TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_support_chat_logs_org_id ON public.support_chat_logs(organization_id);
CREATE INDEX idx_support_chat_logs_user_id ON public.support_chat_logs(user_id);
CREATE INDEX idx_support_chat_logs_cnpj_id ON public.support_chat_logs(cnpj_id);
CREATE INDEX idx_support_chat_logs_inserted_at ON public.support_chat_logs(inserted_at);
CREATE INDEX idx_support_chat_logs_category ON public.support_chat_logs(category);

-- RLS
ALTER TABLE public.support_chat_logs ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT ON public.support_chat_logs TO authenticated;
GRANT ALL ON public.support_chat_logs TO service_role;

-- Policies
CREATE POLICY "Super admins can view all support chat logs" ON public.support_chat_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role::text = 'super_admin'
        )
    );

CREATE POLICY "Org admins can view their own org support chat logs" ON public.support_chat_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.organization_id = support_chat_logs.organization_id
            AND user_roles.role::text = 'org_admin'
        )
    );

CREATE POLICY "Users can view their own support chat logs" ON public.support_chat_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE public.support_chat_logs IS 'Logs of interactions with the Nexo Assistente chatbot for usage analytics.';