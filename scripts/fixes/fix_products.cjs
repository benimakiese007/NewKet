const fs = require('fs');
const path = 'frontend/src/services/products.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix _handleUpdatedProductRealtime
content = content.replace(
    /(_handleUpdatedProductRealtime\(rawProduct\) \{)(\s*const updated = this._mapProduct\(rawProduct\);)/,
    `$1
        if (rawProduct.is_archived) {
            this.products = this.products.filter(p => p.id !== rawProduct.id);
            this._totalCount = Math.max(0, this._totalCount - 1);
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            return;
        }$2`
);

// 2. Fix fetchFreshData - Main query
content = content.replace(
    /fetchWithFilters\('products',\s*{\s*select: '\*, users!supplier_email\\(company_name, name, avatar, seller_type\\)',\s*order: \['created_at', { ascending: false }\],\s*limit: PRODUCTS_PAGE_SIZE\s*}\)/,
    `fetchWithFilters('products', {
                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',
                        eq: [['is_archived', false]],
                        order: ['created_at', { ascending: false }],
                        limit: PRODUCTS_PAGE_SIZE
                    })`
);

// 3. Fix fetchFreshData - Fallback query
content = content.replace(
    /fetchWithFilters\('products',\s*{\s*select: '\*',\s*order: \['created_at', { ascending: false }\],\s*limit: PRODUCTS_PAGE_SIZE\s*}\)/,
    `fetchWithFilters('products', {
                        select: '*',
                        eq: [['is_archived', false]],
                        order: ['created_at', { ascending: false }],
                        limit: PRODUCTS_PAGE_SIZE
                    })`
);

// 4. Fix fetchFreshData - Pinned products query
content = content.replace(
    /fetchWithFilters\('products',\s*{\s*select: '\*, users!supplier_email\\(company_name, name, avatar, seller_type\\)',\s*order: \['created_at', { ascending: false }\],\s*eq: \[\['pinned', true\]\]\s*}\)/,
    `fetchWithFilters('products', {
                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',
                        order: ['created_at', { ascending: false }],
                        eq: [['pinned', true], ['is_archived', false]]
                    })`
);

// 5. Fix loadMore - Main query
content = content.replace(
    /fetchWithFilters\('products',\s*{\s*select: '\*, users!supplier_email\\(company_name, name, avatar, seller_type\\)',\s*order: \['created_at', { ascending: false }\],\s*range: \[offset, offset \+ PRODUCTS_PAGE_SIZE - 1\]\s*}\)/,
    `fetchWithFilters('products', {
                    select: '*, users!supplier_email(company_name, name, avatar, seller_type)',
                    eq: [['is_archived', false]],
                    order: ['created_at', { ascending: false }],
                    range: [offset, offset + PRODUCTS_PAGE_SIZE - 1]
                })`
);

// 6. Fix loadMore - Probe query
content = content.replace(
    /fetchWithFilters\('products',\s*{\s*select: 'id',\s*order: \['created_at', { ascending: false }\],\s*range: \[offset \+ PRODUCTS_PAGE_SIZE, offset \+ PRODUCTS_PAGE_SIZE\]\s*}\)/,
    `fetchWithFilters('products', {
                        select: 'id',
                        eq: [['is_archived', false]],
                        order: ['created_at', { ascending: false }],
                        range: [offset + PRODUCTS_PAGE_SIZE, offset + PRODUCTS_PAGE_SIZE]
                    })`
);

fs.writeFileSync(path, content);
console.log('Done modifying products.js');
