const fs = require('fs');
const transcriptPath = 'c:/Users/tmaut/.gemini/antigravity/brain/313d3244-5c04-42d0-b617-f1cbb6a801f3/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
for (const line of lines) {
    if (line.includes('"toolAction":"Adding payouts logic"')) {
        const data = JSON.parse(line);
        const args = data.tool_calls[0].args;
        let content = '';
        if (args.ReplacementChunks) {
            args.ReplacementChunks.forEach((chunk, idx) => {
                content += `\n--- CHUNK ${idx} ---\n` + chunk.ReplacementContent;
            });
        } else if (args.ReplacementContent) {
            content = args.ReplacementContent;
        } else {
            content = "No replacement content found.";
        }
        fs.writeFileSync('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/payouts_content.txt', content, 'utf8');
        console.log("Extracted!");
        break;
    }
}
