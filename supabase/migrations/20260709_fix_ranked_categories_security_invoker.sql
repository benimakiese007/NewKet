-- Mirror the live Supabase fix for category ranking views.
CREATE OR REPLACE VIEW public.categories_ranked WITH (security_invoker = true) AS
SELECT
    category,
    count(*) AS nb_produits,
    COALESCE(sum(views), 0::bigint) AS total_vues,
    COALESCE(sum(reviews), 0::bigint) AS total_reviews,
    avg(rating) AS note_moyenne,
    COALESCE(sum(views), 0::bigint) * 2 + COALESCE(sum(reviews), 0::bigint) * 3 + count(*) AS score
FROM products
WHERE category IS NOT NULL AND category <> ''
GROUP BY category
ORDER BY score DESC;

CREATE OR REPLACE VIEW public.ranked_categories WITH (security_invoker = true) AS
SELECT
    category,
    count(id) AS product_count,
    sum(views) AS total_views
FROM products
WHERE category IS NOT NULL AND category <> '' AND status = 'active'
GROUP BY category
ORDER BY total_views DESC, product_count DESC;
