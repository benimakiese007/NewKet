const fs = require('fs');
const path = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/assets/css/admin.css';
let css = fs.readFileSync(path, 'utf8');

// The broken section uses \r\n line endings
const brokenBlock = `.premium-table thead th {\r\n    background: #f8fafc;\r\n    padding: var(--space-md);\r\n\r\n    #tab-dashboard .vendor-card-header {`;

const fixedBlock = `.premium-table thead th {\r\n    background: #f8fafc;\r\n    padding: var(--space-md);\r\n    font-size: 0.65rem;\r\n    font-weight: 900;\r\n    color: #64748b;\r\n    text-transform: uppercase;\r\n    letter-spacing: 0.1em;\r\n    border-bottom: 2px solid #f1f5f9;\r\n}\r\n\r\n/* Vendor product card MODIFIER btn label: hidden on tiny screens, visible from 360px */\r\n.vendor-product-btn-label { display: none; }\r\n@media (min-width: 360px) {\r\n    .vendor-product-btn-label { display: inline; }\r\n}\r\n\r\n@media (max-width: 768px) {\r\n    .premium-table tbody td {\r\n        width: 100% !important;\r\n        justify-content: center !important;\r\n    }\r\n\r\n    #tab-dashboard .vendor-card-header {`;

if (css.includes(brokenBlock)) {
    css = css.replace(brokenBlock, fixedBlock);
    fs.writeFileSync(path, css);
    console.log('Fixed successfully');
} else {
    console.log('Still not found. Dumping raw bytes around the issue...');
    const idx = css.indexOf('.premium-table thead th {');
    console.log(JSON.stringify(css.substring(idx, idx+200)));
}
