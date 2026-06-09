
ALTER TABLE public.epi_signed_terms DISABLE TRIGGER USER;

UPDATE public.epi_deliveries SET signed_term_id=NULL WHERE organization_id='6a32b540-a4e2-4668-8907-acb2d0834c0d';
DELETE FROM public.epi_signed_terms WHERE organization_id='6a32b540-a4e2-4668-8907-acb2d0834c0d';
DELETE FROM public.epi_deliveries WHERE organization_id='6a32b540-a4e2-4668-8907-acb2d0834c0d';

ALTER TABLE public.epi_signed_terms ENABLE TRIGGER USER;
