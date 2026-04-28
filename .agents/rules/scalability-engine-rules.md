# Scalability Engine Rules (NEWKET)

Ces regles s'appliquent a toute feature livree pour eviter les regressions de scalabilite.

## Interdits (casse la scalabilite)

- Endpoint qui depend d'un etat serveur (memoire, variables globales, singleton mutable)
- Charger une liste sans pagination
- Requete DB lourde sans limite (pas de LIMIT, pas de garde-fous)
- N+1 queries non maitrisees
- Feature "temps reel" par defaut pour des calculs lourds (stats, aggregations)

## Obligations

- API stateless (tokens/JWT, sessions minimales)
- Pagination obligatoire sur les listes (API + UI)
- Index sur champs critiques utilises en filtres/joins (ex: `user_id`, `product_id`, `order_id`)
- Caching sur les hot paths (accueil, produits populaires, recherche) avec invalidation claire
- Taches non critiques en async (queue) : notifications, emails, logs, calculs lourds
- Rate limiting et anti-abus sur endpoints sensibles (commandes, recherche, auth)

## NEWKET - zones critiques a proteger

- Recherche produits
- Page d'accueil
- Commandes simultanees / checkout
- Dashboards vendeurs (stats, listes commandes)

