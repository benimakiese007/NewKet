const fs = require('fs');
const path = require('path');

const uiHelpersPath = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui-helpers.js';
const componentsLoaderPath = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/components-loader.js';
const adminLayoutPath = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/admin-layout.js';
const indexHtmlPath = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/index.html';

// 1. Optimiser les images de fallback dans ui-helpers (c_limit,w_800)
if (fs.existsSync(uiHelpersPath)) {
    let content = fs.readFileSync(uiHelpersPath, 'utf8');
    content = content.replace(/f_auto,q_auto\/v1782572380\/newket_assets\/frontend\/src\/assets\/Images\/default\.jpg/g, 
                             'c_limit,w_800,f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg');
    fs.writeFileSync(uiHelpersPath, content, 'utf8');
    console.log('Optimized ui-helpers.js (fallback images)');
}

// 2. Optimiser les logos dans components-loader et admin-layout (c_limit,w_400)
[componentsLoaderPath, adminLayoutPath].forEach(filePath => {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        // Logo Header
        content = content.replace(/f_auto,q_auto\/v1782572408\/newket_assets\/racine\/Logo_NewKet_Pour_Les_HEADERs_Only\.png/g, 
                                 'c_limit,w_400,f_auto,q_auto/v1782572408/newket_assets/racine/Logo_NewKet_Pour_Les_HEADERs_Only.png');
        // Logo Officiel
        content = content.replace(/f_auto,q_auto\/v1782572406\/newket_assets\/racine\/Logo_Header_Officiel_PNG\.png/g, 
                                 'c_limit,w_400,f_auto,q_auto/v1782572406/newket_assets/racine/Logo_Header_Officiel_PNG.png');
        // Logo Vert Fond Blanc
        content = content.replace(/f_auto,q_auto\/v1782572411\/newket_assets\/racine\/Logo_Vert_Pour_Fond_Blanc\.png/g, 
                                 'c_limit,w_400,f_auto,q_auto/v1782572411/newket_assets/racine/Logo_Vert_Pour_Fond_Blanc.png');
        // Logo Footer
        content = content.replace(/f_auto,q_auto\/v1782572389\/newket_assets\/frontend\/src\/assets\/Images\/logo-newket\.png/g, 
                                 'c_limit,w_400,f_auto,q_auto/v1782572389/newket_assets/frontend/src/assets/Images/logo-newket.png');
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Optimized ${path.basename(filePath)} (logos)`);
    }
});

// 3. Optimiser l'image de la bannière dans index.html (c_limit,w_1600 pour les écrans larges)
if (fs.existsSync(indexHtmlPath)) {
    let content = fs.readFileSync(indexHtmlPath, 'utf8');
    content = content.replace(/f_auto,q_auto\/v1782572394\/newket_assets\/frontend\/src\/assets\/Images\/marketplace-hero\.jpg/g, 
                             'c_limit,w_1600,f_auto,q_auto/v1782572394/newket_assets/frontend/src/assets/Images/marketplace-hero.jpg');
    fs.writeFileSync(indexHtmlPath, content, 'utf8');
    console.log('Optimized index.html (hero banner)');
}
