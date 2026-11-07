// Supabase Edge Function: push-live-activity
// Envoie des notifications Apple Push (APNs) de type "liveactivity"
// pour réveiller et mettre à jour la Dynamic Island et l'Écran Verrouillé
// même lorsque l'iPhone est verrouillé et l'application NewKet complètement éteinte.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Clés et configuration Apple APNs (Secrets Supabase)
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID") ?? "";
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID") ?? "";
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "com.newket.app";
const APNS_PRIVATE_KEY_RAW = Deno.env.get("APNS_PRIVATE_KEY") ?? "";
const APNS_ENV = Deno.env.get("APNS_ENVIRONMENT") ?? "production"; // "production" ou "sandbox"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Dictionnaires de suivi (Acheteur et Vendeur - 0 mention de livreur/coursier)
const BUYER_MAPPING: Record<string, { step: number; progress: number; title: string; desc: string }> = {
  PENDING: { step: 1, progress: 0.15, title: "Commande confirmée", desc: "Paiement validé. En attente de la boutique." },
  PAID_HELD: { step: 1, progress: 0.25, title: "Paiement sécurisé 🔒", desc: "Fonds sous séquestre. En attente de la boutique." },
  PROCESSING: { step: 2, progress: 0.40, title: "Préparation en cours", desc: "Le vendeur prépare vos articles." },
  READY_FOR_DELIVERY: { step: 2, progress: 0.50, title: "Colis prêt", desc: "Le vendeur a préparé votre colis." },
  SHIPPED: { step: 3, progress: 0.65, title: "Commande expédiée", desc: "Votre colis a quitté la boutique du vendeur." },
  IN_DELIVERY: { step: 3, progress: 0.85, title: "En cours de livraison 🛵", desc: "Le vendeur est en route vers votre adresse." },
  DELIVERED: { step: 4, progress: 1.0, title: "Commande livrée 🎉", desc: "Colis remis par le vendeur. Merci !" },
  COMPLETED: { step: 4, progress: 1.0, title: "Commande terminée", desc: "Transaction clôturée avec succès." },
  CANCELLED: { step: 1, progress: 0.0, title: "Commande annulée ❌", desc: "La commande a été annulée." },
  REFUNDED: { step: 1, progress: 0.0, title: "Commande remboursée", desc: "Les fonds ont été restitués." },
  DISPUTED: { step: 2, progress: 0.5, title: "Litige en cours ⚠️", desc: "Service client en cours d'examen." }
};

const VENDOR_MAPPING: Record<string, { step: number; progress: number; title: string; desc: string }> = {
  PENDING: { step: 1, progress: 0.15, title: "Nouvelle commande 🛍️", desc: "Un client a passé commande." },
  PAID_HELD: { step: 1, progress: 0.25, title: "Paiement garanti 🔒", desc: "Fonds sécurisés par NewKet. Préparez la commande !" },
  PROCESSING: { step: 2, progress: 0.40, title: "Préparation en cours 📦", desc: "Emballage des articles et vérification." },
  READY_FOR_DELIVERY: { step: 2, progress: 0.50, title: "Colis prêt à livrer 🏷️", desc: "Votre colis est prêt pour la livraison." },
  SHIPPED: { step: 3, progress: 0.65, title: "Départ en livraison 🚚", desc: "Vous êtes en route pour livrer la commande." },
  IN_DELIVERY: { step: 3, progress: 0.85, title: "En cours d acheminement 🛵", desc: "Vous approchez du domicile du client." },
  DELIVERED: { step: 4, progress: 1.0, title: "Colis remis au client 🎉", desc: "Colis remis. Vos fonds sont débloqués !" },
  COMPLETED: { step: 4, progress: 1.0, title: "Vente clôturée 💰", desc: "Fonds disponibles sur votre solde NewKet." },
  CANCELLED: { step: 1, progress: 0.0, title: "Vente annulée ❌", desc: "La commande client a été annulée." },
  REFUNDED: { step: 1, progress: 0.0, title: "Vente remboursée ↩️", desc: "Montant remboursé au client." },
  DISPUTED: { step: 2, progress: 0.5, title: "Litige client ouvert ⚠️", desc: "Consultez l administration NewKet." }
};

// Utilitaire de conversion Base64URL
function base64UrlEncode(data: Uint8Array | string): string {
  let str: string;
  if (typeof data === "string") {
    str = btoa(data);
  } else {
    str = btoa(String.fromCharCode(...data));
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Génération du JWT Apple ES256 natif
async function generateAppleJwt(): Promise<string> {
  const header = JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID });
  const claims = JSON.stringify({
    iss: APNS_TEAM_ID,
    iat: Math.floor(Date.now() / 1000)
  });

  const encodedHeader = base64UrlEncode(header);
  const encodedClaims = base64UrlEncode(claims);
  const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`);

  // Nettoyage de la clé privée PEM
  const pem = APNS_PRIVATE_KEY_RAW
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/[\r\n\s]/g, "");

  const binaryDer = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    dataToSign
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  return `${encodedHeader}.${encodedClaims}.${encodedSignature}`;
}

// Fonction d'envoi push à Apple APNs
async function sendApnsPush(token: string, payload: Record<string, unknown>, jwt: string): Promise<{ success: boolean; status: number; body?: string }> {
  const host = APNS_ENV === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const url = `https://${host}/3/device/${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-push-type": "liveactivity",
      "apns-topic": `${APNS_BUNDLE_ID}.push-type.liveactivity`,
      "apns-priority": "10",
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const bodyText = await res.text().catch(() => "");
  return { success: res.ok, status: res.status, body: bodyText };
}

// Point d'entrée de la fonction Edge Supabase
Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));

    // Le corps peut venir soit d'un Database Webhook ({ record, old_record, type })
    // soit d'un appel direct ({ order_id, status, ... })
    const record = body.record || body;
    const oldRecord = body.old_record || null;

    const orderId = record.id;
    const newStatus = (record.status || "PENDING").toUpperCase();
    const oldStatus = oldRecord ? (oldRecord.status || "").toUpperCase() : null;

    // Si pas de changement et qu'il y a un old_record, ignorer
    if (oldStatus && oldStatus === newStatus && !body.force) {
      return new Response(JSON.stringify({ skipped: true, reason: "Status unchanged" }), { status: 200 });
    }

    // Récupérer le token de suivi de l'acheteur ou du vendeur
    const pushToken = record.live_activity_token || record.vendor_live_activity_token;

    if (!pushToken) {
      return new Response(JSON.stringify({ skipped: true, reason: "No live_activity_token registered for this order" }), { status: 200 });
    }

    // Si les clés Apple ne sont pas encore configurées
    if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY_RAW) {
      console.warn("[APNs] Clés Apple APNs non configurées dans les secrets Supabase. Push ignoré.");
      return new Response(JSON.stringify({
        warning: "APNs credentials not configured in Supabase secrets (APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY)",
        orderId,
        newStatus
      }), { status: 200 });
    }

    // Génération du token JWT signé
    const jwt = await generateAppleJwt();

    // Déterminer si l'activité est acheteur ou vendeur
    const isVendor = Boolean(record.vendor_live_activity_token && !record.live_activity_token);
    const mappingDict = isVendor ? VENDOR_MAPPING : BUYER_MAPPING;
    const stepInfo = mappingDict[newStatus] || mappingDict["PROCESSING"];

    const isEndEvent = newStatus === "COMPLETED" || newStatus === "CANCELLED";
    const nowSec = Math.floor(Date.now() / 1000);

    const apnsPayload = {
      aps: {
        timestamp: nowSec,
        event: isEndEvent ? "end" : "update",
        "dismissal-date": newStatus === "COMPLETED" ? nowSec + 20 : undefined,
        "content-state": {
          status: newStatus,
          statusTitle: stepInfo.title,
          statusDescription: stepInfo.desc,
          progress: stepInfo.progress,
          currentStep: stepInfo.step,
          totalSteps: 4,
          etaText: isVendor ? "Vente en cours" : "En cours",
          isCancelled: newStatus === "CANCELLED" || newStatus === "DISPUTED"
        }
      }
    };

    console.log(`[APNs] Envoi push pour #${orderId} (Statut: ${newStatus})...`);
    const pushResult = await sendApnsPush(pushToken, apnsPayload, jwt);

    console.log(`[APNs] Résultat Apple pour #${orderId}:`, pushResult.status, pushResult.body);

    return new Response(JSON.stringify({
      success: pushResult.success,
      status: pushResult.status,
      body: pushResult.body,
      orderId,
      newStatus
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[APNs] Erreur inattendue :", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
  }
});
