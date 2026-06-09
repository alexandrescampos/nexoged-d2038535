-- Limpar logs órfãos (usuários que já foram deletados)
DELETE FROM public.user_audit_log 
WHERE target_user_id NOT IN (SELECT id FROM public.profiles);

-- Adicionar Foreign Keys para a tabela user_audit_log
ALTER TABLE public.user_audit_log
ADD CONSTRAINT user_audit_log_target_user_id_fkey 
FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT user_audit_log_performed_by_fkey 
FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD CONSTRAINT user_audit_log_organization_id_fkey 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;