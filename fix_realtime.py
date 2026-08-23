import os

path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\services\products.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

replacements = [
    (
        "_handleUpdatedProductRealtime(rawProduct) {\n        if (rawProduct.is_archived) {\n            this.products = this.products.filter(p => p.id !== rawProduct.id);\n            this._totalCount = Math.max(0, this._totalCount - 1);\n            window.dispatchEvent(new CustomEvent('productsUpdated'));\n            return;\n        }\n        const updated = this._mapProduct(rawProduct);\n        const idx = this.products.findIndex(p => p.id === updated.id);\n        if (idx !== -1) {\n            this.products[idx] = updated;\n        }\n        window.dispatchEvent(new CustomEvent('productsUpdated'));\n    },",
        "_handleUpdatedProductRealtime(rawProduct) {\n        const updated = this._mapProduct(rawProduct);\n        \n        if (updated.is_archived) {\n            // Remove from public products if it was there\n            const wasInProducts = this.products.some(p => p.id === updated.id);\n            if (wasInProducts) {\n                this.products = this.products.filter(p => p.id !== updated.id);\n                this._totalCount = Math.max(0, this._totalCount - 1);\n            }\n            \n            // Add to archived products if it wasn't there\n            const isAlreadyArchived = this._archivedProducts.some(p => p.id === updated.id);\n            if (!isAlreadyArchived) {\n                this._archivedProducts.push(updated);\n                window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));\n            } else {\n                // Update it in archived products\n                const archIdx = this._archivedProducts.findIndex(p => p.id === updated.id);\n                if (archIdx !== -1) this._archivedProducts[archIdx] = updated;\n                window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));\n            }\n            \n            if (wasInProducts) window.dispatchEvent(new CustomEvent('productsUpdated'));\n            return;\n        }\n\n        // It is NOT archived (either newly restored or just updated)\n        // Remove from archived products if it was there\n        const archIdx = this._archivedProducts.findIndex(p => p.id === updated.id);\n        if (archIdx !== -1) {\n            this._archivedProducts.splice(archIdx, 1);\n            window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));\n        }\n\n        // Update or add to public products\n        const idx = this.products.findIndex(p => p.id === updated.id);\n        if (idx !== -1) {\n            this.products[idx] = updated;\n        } else {\n            // It was restored, we add it to the top\n            this.products.unshift(updated);\n            this._totalCount++;\n        }\n        window.dispatchEvent(new CustomEvent('productsUpdated'));\n    },"
    ),
    (
        "this.products = this.products.filter(p => p.id !== id);\n                this._totalCount--;\n                window.dispatchEvent(new CustomEvent('productsUpdated'));\n                if (window.ActivityManager)",
        "this.products = this.products.filter(p => p.id !== id);\n                this._totalCount--;\n                window.dispatchEvent(new CustomEvent('productsUpdated'));\n                window.dispatchEvent(new CustomEvent('archivedProductsUpdated'));\n                if (window.ActivityManager)"
    )
]

for f_str, r_str in replacements:
    if f_str in content:
        content = content.replace(f_str, r_str)
        print(f"Replaced {f_str[:30]}...")
    else:
        print(f"COULD NOT FIND {f_str[:30]}...")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
