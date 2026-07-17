const fs = require('fs');
const path = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/assets/css/admin.css';
let css = fs.readFileSync(path, 'utf8');

// The file is currently broken. I need to fix the vendor-table-shell media query.
// Let's find `#tab-dashboard .vendor-table-shell {` and replace everything after it until `#tab-dashboard .vendor-orders-table th:nth-child(3),`
const startStr = `#tab-dashboard .vendor-table-shell {\r\n        margin-inline: 0;\r\n        padding-inline: 0;\r\n        overflow-x: auto;\r\n        -webkit-overflow-scrolling: touch;\r\n        overscroll-behavior-x: contain;\r\n        touch-action: pan-x;\r\n        scrollbar-width: thin;\r\n        scrollbar-color: rgba(0, 0, 0, 0.18) transparent;\r\n        display: block;\r\n        width: 100%;`;
const endStr = `    #tab-dashboard .vendor-orders-table th:nth-child(3),\r\n    #tab-dashboard .vendor-orders-table td:nth-child(3) {\r\n        min-width: 180px;\r\n    }`;

const startIndex = css.indexOf(startStr);
const endIndex = css.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = `${startStr}
        max-width: 100%;
        padding-bottom: 10px;
        overflow-y: hidden;
    }

    #tab-dashboard .vendor-orders-table {
        min-width: 760px;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0;
    }

    /* Make the horizontal scroll reach the very end on mobile */
    #tab-dashboard .vendor-table-shell .vendor-orders-table {
        display: table;
        width: 100%;
        min-width: 1120px;
    }

    #tab-dashboard .vendor-orders-table th:nth-child(1),
    #tab-dashboard .vendor-orders-table td:nth-child(1) {
        min-width: 96px;
    }

    #tab-dashboard .vendor-orders-table th:nth-child(2),
    #tab-dashboard .vendor-orders-table td:nth-child(2) {
        min-width: 240px;
    }

${endStr}`;
    css = css.substring(0, startIndex) + newContent + css.substring(endIndex + endStr.length);
    fs.writeFileSync(path, css);
    console.log('Fixed CSS');
} else {
    // If not found, log what's there
    console.log('Not found. start index:', startIndex, 'end index:', endIndex);
    console.log(css.substring(startIndex > -1 ? startIndex : css.length - 1000));
}
