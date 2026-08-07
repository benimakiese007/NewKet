const fs = require('fs');
let content = fs.readFileSync('src/pages/product.html', 'utf8');
content = content.replace(
  "document.getElementById('productPrice').textContent = priceStr;",
  "const pp = document.getElementById('productPrice'); if(pp) { pp.textContent = priceStr; pp.setAttribute('data-price-cdf', p.price); }"
);
content = content.replace(
  "oldPriceEl.textContent = oldPriceStr;",
  "oldPriceEl.textContent = oldPriceStr; oldPriceEl.setAttribute('data-price-cdf', oldPrice);"
);
fs.writeFileSync('src/pages/product.html', content);
console.log('done');
