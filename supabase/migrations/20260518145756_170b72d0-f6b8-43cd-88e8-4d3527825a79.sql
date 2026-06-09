CREATE OR REPLACE FUNCTION public.check_user_has_history(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_history BOOLEAN := FALSE;
BEGIN
    -- Verificar entregas de EPI
    SELECT EXISTS (
        SELECT 1 FROM public.epi_deliveries WHERE delivered_by = p_user_id
    ) INTO has_history;
    
    IF has_history THEN RETURN TRUE; END IF;

    -- Verificar solicitações de EPI
    SELECT EXISTS (
        SELECT 1 FROM public.epi_requests WHERE requested_by = p_user_id OR responded_by = p_user_id
    ) INTO has_history;
    
    IF has_history THEN RETURN TRUE; END IF;

    -- Verificar termos assinados
    SELECT EXISTS (
        SELECT 1 FROM public.epi_signed_terms WHERE uploaded_by = p_user_id OR operator_user_id = p_user_id
    ) INTO has_history;
    
    IF has_history THEN RETURN TRUE; END IF;

    -- Verificar log de auditoria (opcional, mas recomendado se for um histórico importante)
    -- SELECT EXISTS (
    --     SELECT 1 FROM public.user_audit_log WHERE user_id = p_user_id
    -- ) INTO has_history;
    -- IF has_history THEN RETURN TRUE; END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
