-- Migration: Create a view for ranked categories based on product views
CREATE OR REPLACE VIEW ranked_categories WITH (security_invoker = true) AS
SELECT 
    category,
    COUNT(id) as product_count,
    SUM(views) as total_views
FROM 
    products
WHERE 
    category IS NOT NULL
    AND category != ''
    AND status = 'active'
GROUP BY 
    category
ORDER BY 
    total_views DESC, product_count DESC;

-- Optional: Create an RPC to fetch this easily from Supabase JS if needed
CREATE OR REPLACE FUNCTION get_ranked_categories()
RETURNS TABLE (
    category text,
    product_count bigint,
    total_views bigint
) 
LANGUAGE sql 
STABLE
AS $$
    SELECT * FROM ranked_categories;
$$;
