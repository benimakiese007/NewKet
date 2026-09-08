-- ============================================================
-- Migration : update seller_stats view to include status
-- ============================================================

CREATE OR REPLACE VIEW seller_stats AS
SELECT
    u.id,
    u.email,
    u.name,
    u.company_name,
    u.avatar,
    u.cover_image,
    u.store_description,
    u.seller_type,
    u.date_joined,

    ROUND(COALESCE(AVG(pr.rating), 0)::numeric, 1)  AS avg_rating,
    COUNT(DISTINCT pr.id)::int                        AS rating_count,
    COUNT(DISTINCT o.id)::int                         AS sales_count,
    u.status

FROM users u
LEFT JOIN products p
    ON p.supplier_email = u.email
LEFT JOIN product_reviews pr
    ON pr.product_id = p.id
LEFT JOIN orders o
    ON o.vendor_id::text = u.id
   AND o.status != 'Annulée'

WHERE u.role IN ('vendor', 'supplier', 'fournisseur', 'seller')

GROUP BY
    u.id,
    u.email,
    u.name,
    u.company_name,
    u.avatar,
    u.cover_image,
    u.store_description,
    u.seller_type,
    u.date_joined,
    u.status

ORDER BY u.date_joined DESC;

-- Accès public en lecture (même politique que la table users pour les vendeurs)
GRANT SELECT ON seller_stats TO anon, authenticated;
