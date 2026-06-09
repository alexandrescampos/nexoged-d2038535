
-- Estorno de 6 entregas equivocadas (Multibag, 04/05/2026, Paula)
DO $$
BEGIN
  -- Reverter estoque (stock_source = new) no CNPJ dc7043b7
  UPDATE epi_cnpj_stock SET stock_quantity = stock_quantity + 1 WHERE epi_id = '4aa56215-2fcc-475a-8629-61a2b76a2381' AND organization_cnpj_id = 'dc7043b7-7c78-4b8f-aee5-ffd9fed110f3';
  UPDATE epi_cnpj_stock SET stock_quantity = stock_quantity + 2 WHERE epi_id = '011a5ec3-cb50-4e24-a8ad-eaea7ee8b602' AND organization_cnpj_id = 'dc7043b7-7c78-4b8f-aee5-ffd9fed110f3';
  UPDATE epi_cnpj_stock SET stock_quantity = stock_quantity + 2 WHERE epi_id = '12745bf0-810c-4bd1-988c-6cfc44b16960' AND organization_cnpj_id = 'dc7043b7-7c78-4b8f-aee5-ffd9fed110f3';
  UPDATE epi_cnpj_stock SET stock_quantity = stock_quantity + 1 WHERE epi_id = '7c47d5b3-bd79-4d7e-93fc-084c6899291d' AND organization_cnpj_id = 'dc7043b7-7c78-4b8f-aee5-ffd9fed110f3';
  UPDATE epi_cnpj_stock SET stock_quantity = stock_quantity + 1 WHERE epi_id = 'd251924a-7ef4-4212-876c-e2b09b63796a' AND organization_cnpj_id = 'dc7043b7-7c78-4b8f-aee5-ffd9fed110f3';
  UPDATE epi_cnpj_stock SET stock_quantity = stock_quantity + 1 WHERE epi_id = 'ee20c88b-641d-4c5a-a2ad-d675dd9ac455' AND organization_cnpj_id = 'dc7043b7-7c78-4b8f-aee5-ffd9fed110f3';

  -- Excluir entregas
  DELETE FROM epi_deliveries WHERE id IN (
    'f3c41309-2146-4ba9-a925-dca1c5eb308b',
    '856e0f42-cd40-4e6b-ac41-94bdcdb94980',
    '5c6119c2-271a-4b74-a0b6-3284e1bb40e3',
    '78a7d032-2b8e-4d80-b17e-992f7431f271',
    'e4629b51-907c-404e-9eb5-f03cb4ab098a',
    '9b7ce1cd-c7e9-45c2-9429-bc4df89b5395'
  );

  -- Excluir termos assinados (contornar trigger de imutabilidade)
  ALTER TABLE epi_signed_terms DISABLE TRIGGER USER;
  DELETE FROM epi_signed_terms WHERE id IN (
    'be3a15da-b11d-4649-ad93-35e3438ce888',
    '90b747dd-9191-47ff-be3e-ff6089c60f8e'
  );
  ALTER TABLE epi_signed_terms ENABLE TRIGGER USER;
END $$;
