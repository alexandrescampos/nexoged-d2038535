-- Remover tabelas legadas de EPI
DROP TABLE IF EXISTS public.epi_signed_terms CASCADE;
DROP TABLE IF EXISTS public.epi_deliveries CASCADE;
DROP TABLE IF EXISTS public.epi_request_items CASCADE;
DROP TABLE IF EXISTS public.epi_requests CASCADE;
DROP TABLE IF EXISTS public.sector_function_epis CASCADE;
DROP TABLE IF EXISTS public.epi_cnpj_stock CASCADE;
DROP TABLE IF EXISTS public.epis CASCADE;
DROP TABLE IF EXISTS public.epi_categories CASCADE;
DROP TABLE IF EXISTS public.caepi_certificates CASCADE;
DROP TABLE IF EXISTS public.caepi_sync_log CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.job_functions CASCADE;
DROP TABLE IF EXISTS public.sectors CASCADE;
DROP TABLE IF EXISTS public.manager_cnpjs CASCADE;
DROP TABLE IF EXISTS public.manager_sectors CASCADE;
DROP TABLE IF EXISTS public.cnpj_stock_sources CASCADE;

-- Limpar colunas da tabela de organizações
ALTER TABLE public.organizations DROP COLUMN IF EXISTS epi_term_text;

-- Remover tipos ENUM legados
DROP TYPE IF EXISTS public.epi_delivery_status CASCADE;
DROP TYPE IF EXISTS public.epi_request_status CASCADE;
DROP TYPE IF EXISTS public.epi_request_item_status CASCADE;

-- Remover funções legadas
DROP FUNCTION IF EXISTS public.merge_epis CASCADE;
DROP FUNCTION IF EXISTS public.merge_job_functions CASCADE;
DROP FUNCTION IF EXISTS public.sync_epi_consolidated_stock CASCADE;
DROP FUNCTION IF EXISTS public.validate_cnpj_stock_source CASCADE;
DROP FUNCTION IF EXISTS public.validate_manager_cnpj_org CASCADE;
DROP FUNCTION IF EXISTS public.validate_manager_sector_org CASCADE;
DROP FUNCTION IF EXISTS public.get_manager_cnpj_ids CASCADE;