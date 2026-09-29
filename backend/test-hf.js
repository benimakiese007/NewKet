async function test() {
    const url = 'https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32';
    const data = { inputs: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60' };
    
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
            console.log('Success! Dimensions:', json.length, 'or', json[0].length);
        } else {
            console.log('Response:', json);
        }
    } catch (e) {
        console.error(e);
    }
}
test();
