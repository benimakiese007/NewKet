import { Router } from 'express';

const router = Router();

function renderDeauthorizePage() {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Meta Deauthorize Callback • NewKet</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Inter, Arial, sans-serif;
      background: linear-gradient(180deg, #f7faf7 0%, #eef7ef 100%);
      color: #0f172a;
    }
    .card {
      width: min(720px, calc(100vw - 32px));
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(15, 23, 42, .08);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, .12);
      padding: 32px;
      box-sizing: border-box;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: #013220;
      color: white;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    h1 { margin: 18px 0 12px; font-size: clamp(28px, 4vw, 44px); line-height: 1.05; }
    p { margin: 0 0 14px; color: #334155; line-height: 1.7; }
    code {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 8px;
      background: #e2f1e8;
      color: #013220;
      font-size: 0.95em;
    }
    .meta {
      margin-top: 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: #64748b;
      font-size: 14px;
    }
    a {
      color: #013220;
      font-weight: 700;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="badge">NewKet</div>
    <h1>Callback de désautorisation Meta actif</h1>
    <p>
      Cette URL est réservée au rappel Meta quand un utilisateur retire l'accès à l'application Facebook.
      Le serveur accepte le callback et renvoie <code>200 OK</code>.
    </p>
    <p>
      Si tu testes cette URL depuis un navigateur, tu peux simplement revenir vers
      <a href="https://newket.vercel.app/">l'accueil NewKet</a> ou consulter
      <a href="https://newket.vercel.app/privacy">la politique de confidentialité</a>.
    </p>
    <div class="meta">
      <span>Endpoint: <code>/api/meta/deauthorize</code></span>
      <span>Méthode: <code>GET</code> et <code>POST</code></span>
    </div>
  </main>
</body>
</html>`;
}

router.get('/deauthorize', (req, res) => {
  res.status(200).type('html').send(renderDeauthorizePage());
});

router.post('/deauthorize', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const signedRequest = typeof body.signed_request === 'string' ? body.signed_request : '';
  const keys = Object.keys(body);

  console.log('[Meta] Deauthorize callback received', {
    hasSignedRequest: Boolean(signedRequest),
    keys,
  });

  return res.status(200).json({
    success: true,
    message: 'Meta deauthorize callback received.',
  });
});

export default router;
