CREATE OR REPLACE FUNCTION public.cleanup_deleted_document_workflows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'deleted' AND OLD.status IS DISTINCT FROM NEW.status THEN
    DELETE FROM public.documento_aprovacao
    WHERE documento_id = NEW.id
      AND status = 'PENDENTE';

    DELETE FROM public.documento_assinatura
    WHERE documento_id = NEW.id
      AND status = 'PENDENTE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_deleted_document_workflows ON public.ged_documents;
CREATE TRIGGER trg_cleanup_deleted_document_workflows
AFTER UPDATE OF status ON public.ged_documents
FOR EACH ROW
WHEN (NEW.status = 'deleted')
EXECUTE FUNCTION public.cleanup_deleted_document_workflows();