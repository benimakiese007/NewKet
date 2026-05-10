# NewKet — Encoding check (UTF-8)

When you see broken French characters across the site (ex: `é`, `À`, `’`, `•`), run:

```powershell
cd "C:\Users\tmaut\Downloads\THE PHOENIX\NewKet"
python tools\encoding-check\fix_text_encoding.py
```

What it does:
- scans `frontend/`, `backend/`, `api/`, `docs/`, `database/` (excluding `dist/` and `node_modules/`)
- rewrites files as strict UTF‑8
- fixes common mojibake sequences used in the project

