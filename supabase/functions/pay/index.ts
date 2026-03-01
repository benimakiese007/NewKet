import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// =========================================================================
// SUPABASE EDGE FUNCTION : PAIEMENT MOBILE MONEY (FLEXPAY)
// =========================================================================

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // Gestion de la pré-vérification CORS (Preflight request)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { amount, phone, orderId, operator } = await req.json()
        const FLEXPAY_TOKEN = Deno.env.get("FLEXPAY_API_TOKEN")

        if (!FLEXPAY_TOKEN) {
            throw new Error("Clé API FlexPay (FLEXPAY_API_TOKEN) non configurée dans Supabase.")
        }

        console.log(`Initialisation paiement: ${amount} CDF pour ${phone} (Commande: ${orderId})`)

        // IMPORTANT : C'est ici que l'appel REEL à FlexPay se fait
        // URL Doc FlexPay: https://flexpay.cd/docs/
        const response = await fetch("https://api.flexpay.cd/v1/merchant/pay", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${FLEXPAY_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                amount: amount,
                currency: "CDF",
                phone: phone,
                merchant_reference: orderId,
                description: `Commande NewKet #${orderId}`,
                // Callback URL pour recevoir le succès du paiement même si le client ferme son navigateur
                callback_url: "https://votre-projet.supabase.co/functions/v1/payment-webhook"
            })
        })

        const result = await response.json()

        // Logique simplifiée pour l'exemple
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || "Erreur interne" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
