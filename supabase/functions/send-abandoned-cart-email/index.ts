import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") ?? "newketmarket@gmail.com";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") ?? "NewKet";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://newket.app";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

Deno.serve(async (req: Request) => {
  // Sécurité : autoriser via CRON_SECRET ou JWT Supabase (anon / service_role)
  const authHeader = req.headers.get("Authorization") ?? "";
  const isAuthorized =
    !CRON_SECRET ||
    authHeader === `Bearer ${CRON_SECRET}` ||
    (authHeader.startsWith("Bearer eyJ") && authHeader.length > 50);

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const results = { processed: 0, emails_sent: 0, errors: 0, orphan_cleaned: 0 };

  // --- Récupérer les paniers abandonnés éligibles ---
  // Conditions :
  // 1. Pas encore atteint 3 rappels
  // 2. Dernière modification > 24h
  // 3. Pas de rappel envoyé récemment (dernier rappel > 24h ou jamais envoyé)
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: carts, error: fetchError } = await supabase
    .from("user_carts")
    .select(`
      user_id,
      cart_data,
      updated_at,
      reminder_count,
      last_reminded_at
    `)
    .lt("reminder_count", 3)
    .lt("updated_at", cutoff24h)
    .or(`last_reminded_at.is.null,last_reminded_at.lt.${cutoff24h}`);

  if (fetchError) {
    console.error("[AbandonedCart] Fetch error:", fetchError.message);
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  if (!carts || carts.length === 0) {
    return new Response(JSON.stringify({ message: "Aucun panier abandonné à traiter.", ...results }), { status: 200 });
  }

  // --- Pour chaque panier éligible ---
  for (const cart of carts) {
    // Parser les articles de manière robuste (supporte Array natif ou JSON stringifié)
    let rawItems: any = cart.cart_data;
    if (typeof rawItems === "string") {
      try {
        rawItems = JSON.parse(rawItems);
      } catch (e) {
        console.warn(`[AbandonedCart] JSON parse error for user ${cart.user_id}:`, e);
        rawItems = [];
      }
    }
    const items: Array<{ name?: string; title?: string; price?: number; quantity?: number; image?: string }> =
      Array.isArray(rawItems) ? rawItems : [];

    if (items.length === 0) continue;

    // Récupérer les infos de l'utilisateur (nom + email)
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("name, email, company_name")
      .eq("id", cart.user_id)
      .maybeSingle();

    if (userError || !user?.email) {
      console.warn(`[AbandonedCart] User ${cart.user_id} introuvable ou supprimé — Nettoyage du panier orphelin.`);
      await supabase.from("user_carts").delete().eq("user_id", cart.user_id);
      results.orphan_cleaned++;
      continue;
    }

    results.processed++;

    const userName = user.company_name || user.name || "cher client";
    const newReminderCount = (cart.reminder_count || 0) + 1;
    const rappelLabels = ["", "1er", "2ème", "3ème"];
    const rappelLabel = rappelLabels[newReminderCount] || `${newReminderCount}ème`;

    // --- Construire le HTML de la liste des produits ---
    const itemsHtml = items.map((item) => {
      const price = Number(item.price || 0).toLocaleString("fr-FR");
      const title = item.name || item.title || "Produit";

      let imageSrc = item.image || "";
      if (imageSrc && !imageSrc.startsWith("http://") && !imageSrc.startsWith("https://")) {
        const cleanPath = imageSrc.startsWith("/") ? imageSrc.slice(1) : imageSrc;
        imageSrc = `${APP_URL}/${cleanPath}`;
      }

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                ${imageSrc ? `
                <td width="60" style="vertical-align:middle;">
                  <img src="${imageSrc}" width="55" height="55" style="border-radius:8px;object-fit:cover;display:block;" alt="${title}" />
                </td>` : ""}
                <td style="padding-left:${imageSrc ? "12px" : "0"};vertical-align:middle;">
                  <div style="font-weight:700;color:#111;font-size:14px;">${title}</div>
                  <div style="color:#666;font-size:13px;margin-top:2px;">Qté : ${item.quantity || 1} &nbsp;·&nbsp; <strong>${price} FC</strong></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }).join("");

    const isLastReminder = newReminderCount === 3;
    const urgencyText = isLastReminder
      ? "⚠️ C'est votre dernier rappel ! Après cela, nous ne vous enverrons plus de notifications pour ce panier."
      : `Il vous reste ${3 - newReminderCount} rappel(s) avant que nous arrêtions de vous notifier.`;

    // --- Construire l'email HTML ---
    const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#f7f7f7;padding:30px 0;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" width="560" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr>
          <td style="background:#013220;padding:28px 32px;text-align:center;">
            <div style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:2px;">NEWKET</div>
            <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">La marketplace congolaise</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111;">
              🛒 ${rappelLabel} rappel — Votre panier vous attend !
            </p>
            <p style="margin:0 0 24px;color:#555;font-size:15px;">
              Bonjour <strong>${userName}</strong>,<br>
              Vous avez laissé ${items.length} article${items.length > 1 ? "s" : ""} dans votre panier NewKet. Ne les laissez pas partir !
            </p>

            <!-- Articles -->
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              ${itemsHtml}
            </table>

            <!-- CTA -->
            <div style="text-align:center;margin:28px 0;">
              <a href="${APP_URL}" 
                 style="display:inline-block;background:#013220;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:800;font-size:15px;letter-spacing:0.5px;">
                Retourner sur NewKet →
              </a>
            </div>

            <!-- Urgency note -->
            <p style="background:#fff8e1;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:6px;font-size:13px;color:#78350f;margin:0;">
              ${urgencyText}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f9f9f9;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#aaa;font-size:11px;">
              Vous recevez cet email car vous avez un compte actif sur NewKet.<br>
              © ${new Date().getFullYear()} NewKet — Kinshasa, RDC
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // --- Envoyer l'email via Brevo ---
    const brevoPayload = {
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: user.email, name: userName }],
      subject: isLastReminder
        ? `⚠️ Dernier rappel — Votre panier NewKet expire bientôt`
        : `🛒 ${rappelLabel} rappel — Vous avez oublié des articles dans votre panier`,
      htmlContent: emailHtml,
    };

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(brevoPayload),
    });

    if (brevoRes.ok) {
      results.emails_sent++;

      // Mettre à jour le compteur en base
      await supabase
        .from("user_carts")
        .update({
          reminder_count: newReminderCount,
          last_reminded_at: now.toISOString(),
          // Si c'est le 3ème rappel, marquer comme définitivement abandonné
          ...(isLastReminder ? { abandoned_at: now.toISOString() } : {}),
        })
        .eq("user_id", cart.user_id);

      console.log(`[AbandonedCart] Email ${rappelLabel} envoyé à ${user.email}`);
    } else {
      const errText = await brevoRes.text();
      console.error(`[AbandonedCart] Brevo error for ${user.email}:`, errText);
      results.errors++;
    }
  }

  return new Response(JSON.stringify({
    message: `Traitement terminé.`,
    ...results,
    timestamp: now.toISOString(),
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
