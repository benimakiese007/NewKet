const fetch = require('node-fetch');

const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iMlPI6QIA0U0qqRfLp5_WA_-443VkDx';

async function main() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=name,image&order=created_at.desc&limit=10`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(e) {
        console.error(e);
    }
}
main();
