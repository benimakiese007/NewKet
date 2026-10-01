-- Fix get_similar_products and search_products_by_image to return product stock and metadata

DROP FUNCTION IF EXISTS public.get_similar_products(text, integer);

CREATE OR REPLACE FUNCTION public.get_similar_products(
    target_product_id text,
    match_count integer DEFAULT 10
)
RETURNS TABLE (
    id text,
    name text,
    image text,
    price numeric,
    stock integer,
    similarity double precision,
    category text,
    rating numeric,
    reviews integer,
    is_new boolean,
    is_promo boolean,
    old_price numeric,
    user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  target_embedding vector(512);
BEGIN
  SELECT image_embedding INTO target_embedding
  FROM products
  WHERE products.id = target_product_id;

  IF target_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    products.id,
    products.name::text,
    products.image,
    products.price,
    products.stock,
    (1 - (products.image_embedding <=> target_embedding))::double precision as similarity,
    products.category,
    products.rating,
    products.reviews,
    products.is_new,
    products.is_promo,
    products.old_price,
    products.user_id
  FROM products
  WHERE products.image_embedding IS NOT NULL
    AND products.id != target_product_id
  ORDER BY products.image_embedding <=> target_embedding
  LIMIT match_count;
END;
$function$;

DROP FUNCTION IF EXISTS public.search_products_by_image(vector, double precision, integer);

CREATE OR REPLACE FUNCTION public.search_products_by_image (
    query_embedding vector,
    match_threshold double precision,
    match_count integer
)
RETURNS TABLE (
    id text,
    name text,
    image text,
    price numeric,
    stock integer,
    similarity double precision,
    category text,
    rating numeric,
    reviews integer,
    is_new boolean,
    is_promo boolean,
    old_price numeric,
    user_id uuid
)
LANGUAGE sql
STABLE
AS $function$
  select
    products.id,
    products.name::text,
    products.image,
    products.price,
    products.stock,
    (1 - (products.image_embedding <=> query_embedding))::double precision as similarity,
    products.category,
    products.rating,
    products.reviews,
    products.is_new,
    products.is_promo,
    products.old_price,
    products.user_id
  from products
  where products.image_embedding is not null
    and (1 - (products.image_embedding <=> query_embedding)) > match_threshold
  order by products.image_embedding <=> query_embedding
  limit match_count;
$function$;
