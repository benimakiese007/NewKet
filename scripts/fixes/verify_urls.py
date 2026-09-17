#!/usr/bin/env python3
"""
NewKet - Script de verification des URLs propres
Verifie que toutes les pages sont accessibles et ne contiennent pas
de liens "sales" (src/pages/ ou .html) dans le code source.

Usage:
  python verify_urls.py              # teste localhost:5173
  python verify_urls.py --prod       # teste newket.vercel.app
  python verify_urls.py --fix        # corrige automatiquement ce qui peut l'etre
"""

import os
import re
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
BASE_DIR  = Path(__file__).parent / "frontend"
PAGES_DIR = BASE_DIR / "src" / "pages"

USE_PROD = "--prod" in sys.argv
AUTO_FIX = "--fix" in sys.argv

BASE_URL = "https://newket.vercel.app" if USE_PROD else "http://localhost:5173"

# Couleurs terminal
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------
def ok(msg):   print(f"  {GREEN}OK {RESET} {msg}")
def err(msg):  print(f"  {RED}ERR{RESET} {msg}")
def warn(msg): print(f"  {YELLOW}WARN{RESET} {msg}")
def info(msg): print(f"  {CYAN}-->{RESET} {msg}")

def section(title):
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}  {title}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}")

def get_all_pages():
    """Retourne la liste de toutes les pages HTML du projet."""
    pages = []
    for f in sorted(PAGES_DIR.iterdir()):
        if f.suffix == ".html" and f.is_file():
            pages.append(("/" + f.stem, f))
    admin_dir = PAGES_DIR / "admin"
    if admin_dir.exists():
        for f in sorted(admin_dir.iterdir()):
            if f.suffix == ".html" and f.is_file():
                pages.append(("/admin/" + f.stem, f))
    return pages

def check_url(path):
    """Fait une requete HTTP et retourne (status_code, success)."""
    url = BASE_URL + path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NewKet-VerifBot/1.0"})
        with urllib.request.urlopen(req, timeout=6) as r:
            return r.status, True, url
    except urllib.error.HTTPError as e:
        return e.code, False, url
    except Exception:
        return 0, False, url

# ---------------------------------------------------------
# CHECK 1 : Accessibilite HTTP de toutes les pages
# ---------------------------------------------------------
def check_1_all_pages_accessible(pages):
    section("1. Accessibilite HTTP de toutes les pages (URL propres)")
    errors = 0
    for clean_path, _ in pages:
        code, success, url = check_url(clean_path)
        if success:
            ok(f"{clean_path:<40} [{code}]")
        else:
            lbl = str(code) if code else "TIMEOUT"
            err(f"{clean_path:<40} [{lbl}]  -> {url}")
            errors += 1
    return errors

# ---------------------------------------------------------
# CHECK 2 : Liens "sales" src/pages/ dans le code source
# ---------------------------------------------------------
def check_2_no_dirty_src_pages():
    section("2. Liens 'sales' src/pages/ dans le code source actif")

    SKIP_DIRS = {"node_modules", ".git", "dist", ".playwright-cli"}
    SKIP_EXT  = {".py", ".json", ".md", ".log", ".lock", ".cjs", ".map"}

    # Patterns de lignes qui sont OK (commentaires, configs internes, etc.)
    ALLOWED = [
        r"^\s*//",
        r"^\s*/\*",
        r"^\s*\*",
        r"placeholder=",
        r"Strip legacy",
        r"Vite dev middleware",
        r"would become",
        r"direct file serv",
        r"getHtmlPages\(",
        r'req\.url\s*=',
        r'"destination".*src/pages',
        r'"source".*src/pages',
        r"Policy:",       # security.txt
    ]

    errors = 0
    found  = []

    for root, dirs, files in os.walk(BASE_DIR):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            if Path(fname).suffix in SKIP_EXT:
                continue
            filepath = Path(root) / fname
            try:
                lines = filepath.read_text(encoding="utf-8", errors="ignore").splitlines()
            except Exception:
                continue
            for i, line in enumerate(lines, 1):
                if "src/pages" not in line:
                    continue
                if any(re.search(p, line) for p in ALLOWED):
                    continue
                rel = str(filepath.relative_to(BASE_DIR.parent))
                found.append((rel, i, line.strip()[:100]))
                errors += 1

    if not found:
        ok("Aucun lien sale detecte dans le code source actif.")
    else:
        for rel, lineno, snippet in found:
            err(f"{rel}:{lineno}  {snippet}")
    return errors

# ---------------------------------------------------------
# CHECK 3 : Extensions .html dans les href
# ---------------------------------------------------------
def check_3_no_html_in_hrefs():
    section("3. Extensions .html dans les href des pages et JS")

    SKIP_DIRS = {"node_modules", ".git", "dist", ".playwright-cli"}
    ALLOWED = [
        r"<!--",
        r"^\s*//",
        r"readFileSync|writeFileSync",
        r"getHtmlPages",
        r"\.html'\s*\)",
        r"placeholder=",
    ]

    errors = 0
    found  = []

    for root, dirs, files in os.walk(BASE_DIR / "src"):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            if Path(fname).suffix not in (".html", ".js"):
                continue
            filepath = Path(root) / fname
            try:
                lines = filepath.read_text(encoding="utf-8", errors="ignore").splitlines()
            except Exception:
                continue
            for i, line in enumerate(lines, 1):
                if "href=" not in line or ".html" not in line:
                    continue
                if any(re.search(p, line) for p in ALLOWED):
                    continue
                rel = str(filepath.relative_to(BASE_DIR.parent))
                found.append((rel, i, line.strip()[:100]))
                errors += 1

    if not found:
        ok("Aucun href avec extension .html detecte.")
    else:
        for rel, lineno, snippet in found:
            warn(f"{rel}:{lineno}  {snippet}")
    return errors

# ---------------------------------------------------------
# CHECK 4 : Coherence vercel.json
# ---------------------------------------------------------
def check_4_vercel_json(pages):
    section("4. Coherence vercel.json (toutes les pages root couvertes)")
    vercel_path = BASE_DIR / "vercel.json"
    if not vercel_path.exists():
        err("vercel.json introuvable !")
        return 1

    data     = json.loads(vercel_path.read_text(encoding="utf-8"))
    rewrites = data.get("rewrites", [])
    sources  = {r["source"] for r in rewrites}

    errors  = 0
    to_add  = []
    for clean_path, _ in pages:
        if clean_path.startswith("/admin"):
            continue  # Couvert par /admin/:path*
        if clean_path in sources:
            ok(f"{clean_path}")
        else:
            err(f"{clean_path}  -> MANQUANT dans vercel.json !")
            to_add.append(clean_path)
            errors += 1

    if AUTO_FIX and to_add:
        idx = next(i for i, r in enumerate(rewrites) if r["source"] == "/admin/:path*")
        for path in to_add:
            rewrites.insert(idx, {"source": path, "destination": f"/src/pages{path}"})
            idx += 1
        vercel_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        info(f"[--fix] {len(to_add)} entree(s) ajoutee(s) dans vercel.json")
        errors = 0

    return errors

# ---------------------------------------------------------
# CHECK 5 : Balises canonical sales
# ---------------------------------------------------------
def check_5_canonical(pages):
    section("5. Balises <link rel='canonical'> dans les pages HTML")
    errors = 0
    for _, html_file in pages:
        try:
            content = html_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        match = re.search(
            r'<link\s[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']',
            content
        )
        if not match:
            continue
        href = match.group(1)
        if "src/pages" in href or (".html" in href and not href.endswith("manifest.html")):
            err(f"{html_file.name:<35} canonical sale : {href}")
            errors += 1
            if AUTO_FIX:
                clean = re.sub(r'/src/pages/', '/', href).rstrip("/")
                clean = re.sub(r'\.html$', '', clean)
                new_content = content.replace(href, clean)
                html_file.write_text(new_content, encoding="utf-8")
                info(f"[--fix] Canonical corrige dans {html_file.name}")
                errors -= 1
        else:
            ok(f"{html_file.name:<35} {href}")
    return errors

# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------
def main():
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  NewKet -- Verificateur d'URLs et de liens propres{RESET}")
    print(f"{BOLD}  Cible : {BASE_URL}{RESET}")
    if AUTO_FIX:
        print(f"{BOLD}{YELLOW}  Mode --fix active : corrections automatiques ON{RESET}")
    print(f"{BOLD}{'='*60}{RESET}")

    pages = get_all_pages()
    n_root  = sum(1 for p, _ in pages if not p.startswith("/admin"))
    n_admin = sum(1 for p, _ in pages if p.startswith("/admin"))
    info(f"{len(pages)} pages trouvees ({n_root} root + {n_admin} admin)")

    total = 0
    total += check_1_all_pages_accessible(pages)
    total += check_2_no_dirty_src_pages()
    total += check_3_no_html_in_hrefs()
    total += check_4_vercel_json(pages)
    total += check_5_canonical(pages)

    section("RESUME FINAL")
    if total == 0:
        print(f"\n  {GREEN}{BOLD}Tout est propre ! Aucune erreur detectee.{RESET}\n")
    else:
        print(f"\n  {RED}{BOLD}{total} probleme(s) detecte(s).{RESET}")
        if not AUTO_FIX:
            print(f"  {YELLOW}Relancez avec --fix pour corriger automatiquement ce qui peut l'etre.{RESET}\n")

    return 0 if total == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
