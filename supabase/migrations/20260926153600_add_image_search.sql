-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Add a column to products to store the image embedding
-- Using 512 dimensions for compatibility with standard CLIP models (e.g. Xenova/clip-vit-base-patch32)
alter table products add column if not exists image_embedding vector(512);

-- Create a function to search for products by image embedding
create or replace function search_products_by_image (
  query_embedding vector(512),
  match_threshold float,
  match_count int
)
returns table (
  id text,
  name varchar,
  image text,
  price numeric,
  similarity float
)
language sql stable
as $$
  select
    products.id,
    products.name,
    products.image,
    products.price,
    1 - (products.image_embedding <=> query_embedding) as similarity
  from products
  where products.image_embedding is not null
    and 1 - (products.image_embedding <=> query_embedding) > match_threshold
  order by products.image_embedding <=> query_embedding
  limit match_count;
$$;
