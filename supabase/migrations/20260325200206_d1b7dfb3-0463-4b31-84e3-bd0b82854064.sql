ALTER TABLE epi_deliveries 
  ALTER COLUMN delivery_date TYPE timestamptz USING delivery_date::timestamptz,
  ALTER COLUMN delivery_date SET DEFAULT now();

ALTER TABLE epi_signed_terms
  ALTER COLUMN delivery_date TYPE timestamptz USING delivery_date::timestamptz;