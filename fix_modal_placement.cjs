const fs = require('fs');
let html = fs.readFileSync('frontend/src/pages/vendor-dashboard.html', 'utf8');

// The modal HTML was wrongly inserted into the print template.
// The print template body line was: `<body>${printContent}</body>`
// But now it's: `<body>${printContent}<div id="orderModal"...>[modal HTML]...[invoice template HTML]\n</body>`
// We need to:
// 1. Extract the modal+invoice HTML from the print template
// 2. Fix the print template body
// 3. Insert modal+invoice HTML just before the real </body>

// Find the misplaced block: starts at <div id="orderModal" inside the print template
// and ends just before the </body> that closes the print template (line 8087 in current)

const printBodyStart = html.indexOf('<body>${printContent}');
if (printBodyStart === -1) {
    console.error('Print body not found');
    process.exit(1);
}

// After ${printContent} is where the modal HTML starts
const afterPrintContent = printBodyStart + '<body>${printContent}'.length;

// Find the closing </body> of the print template (look for </body>\n                </html>)
const printBodyEnd = html.indexOf('</body>\r\n                </html>');
if (printBodyEnd === -1) {
    // Try LF only
    const printBodyEndLF = html.indexOf('</body>\n                </html>');
    if (printBodyEndLF === -1) {
        console.error('Print </body> not found');
        // list what follows the print template close
        const idx = html.indexOf('</html>\n            `);');
        console.log('Found at', idx, html.substring(idx - 50, idx + 100));
        process.exit(1);
    }
}

// Extract the misplaced modal HTML block
let printBodyEndIdx = html.indexOf('</body>\r\n                </html>');
if (printBodyEndIdx === -1) printBodyEndIdx = html.indexOf('</body>\n                </html>');

const misplacedModalHtml = html.substring(afterPrintContent, printBodyEndIdx);
console.log('Misplaced block length:', misplacedModalHtml.length);
console.log('First 100 chars:', misplacedModalHtml.substring(0, 100));

// Fix the print template: restore it to <body>${printContent}</body>
html = html.substring(0, afterPrintContent) + html.substring(printBodyEndIdx);

// Now find the real </body> (the page's own closing tag)
// It should be the last </body> in the file
const realBodyEnd = html.lastIndexOf('</body>');
if (realBodyEnd === -1) {
    console.error('Real </body> not found');
    process.exit(1);
}

// Insert the modal HTML just before the real </body>
html = html.substring(0, realBodyEnd) + '\n' + misplacedModalHtml + '\n' + html.substring(realBodyEnd);

fs.writeFileSync('frontend/src/pages/vendor-dashboard.html', html, 'utf8');
console.log('Fixed: modal HTML moved to correct position before real </body>');
