// fetch est disponible nativement dans Node >= 18 (Vercel)

class OAuthService {
    /**
     * Échange le code Notion contre un access token
     */
    async exchangeNotionCode(code) {
        // Si pas de clés configurées, on retourne un mock (utile pour le test en local)
        if (!process.env.NOTION_CLIENT_ID || !process.env.NOTION_CLIENT_SECRET) {
            console.warn("⚠️ Clés Notion manquantes, utilisation d'un mock.");
            return { access_token: "ntn_mock_" + code, workspace_id: "mock_ws" };
        }

        const clientId = process.env.NOTION_CLIENT_ID;
        const clientSecret = process.env.NOTION_CLIENT_SECRET;
        const redirectUri = process.env.OAUTH_REDIRECT_URI;

        const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await fetch('https://api.notion.com/v1/oauth/token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Basic ${encoded}`
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Erreur Notion OAuth: ${data.error_description || data.error || 'Erreur inconnue'}`);
        }

        return data; // Contient access_token, workspace_id, bot_id, etc.
    }

    /**
     * Échange le code Slack contre un access token (et une URL webhook)
     */
    async exchangeSlackCode(code) {
        // Si pas de clés configurées, on retourne un mock
        if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) {
            console.warn("⚠️ Clés Slack manquantes, utilisation d'un mock.");
            return { 
                access_token: "xoxp-mock-" + code, 
                incoming_webhook: { url: "https://hooks.slack.com/services/mock/mock/mock" } 
            };
        }

        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;
        const redirectUri = process.env.OAUTH_REDIRECT_URI;

        const response = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri
            })
        });

        const data = await response.json();
        if (!data.ok) {
            throw new Error(`Erreur Slack OAuth: ${data.error}`);
        }

        return data; // Contient access_token, incoming_webhook.url, etc.
    }
}

export default new OAuthService();
