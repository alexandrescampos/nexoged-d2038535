-- Criar função de validação para impedir datas futuras
CREATE OR REPLACE FUNCTION public.validate_time_entry_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é permitido registrar horas em datas futuras';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger para validar a data antes de inserir ou atualizar
CREATE TRIGGER check_time_entry_date
BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_time_entry_date();