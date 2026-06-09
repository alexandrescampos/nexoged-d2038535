-- Função IMUTÁVEL para normalizar nomes (lowercase + sem acentos + trim)
-- Não usa unaccent porque ele não é imutável por padrão
CREATE OR REPLACE FUNCTION public.normalize_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $func$
  SELECT lower(trim(translate(coalesce(input, ''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')))
$func$;