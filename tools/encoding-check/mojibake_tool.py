#!/usr/bin/env python3
"""
Mojibake & Encoding Audit and Fix Tool for NewKet
Detects and fixes UTF-8 / Windows-1252 / ISO-8859-1 double encodings and mojibake.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

# Ensure stdout/stderr handle UTF-8 cleanly on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")

# Mapping of mojibake sequences to correct characters
# Sorted from longest to shortest to avoid partial replacements
REPLACEMENTS_MAP = [
    # Triple/Quadruple mojibake variants
    ("\u00C3\u0082\u00C2\u00A9", "\u00A9"),
    ("\u00C3\u0082\u00C2\u00B7", "\u00B7"),
    ("\u00C3\u0085\u201C", "\u0153"),
    ("\u00C3\u2026\u201C", "\u0153"),
    ("\u00C3\u0083\u00C5\u00A0", "\u00CA"),
    ("\u00C3\u0083\u00CB\u02C6", "\u00C8"),
    ("\u00C3\u201A\u00C2\u00A9", "\u00A9"),
    ("\u00C3\u201A\u00C2\u00B7", "\u00B7"),
    ("\u00C3\u0192\u00C5\u00A0", "\u00CA"),
    ("\u00C3\u0192\u00CB\u2020", "\u00C8"),
    ("\u00E2\u00E2\u20AC\u00A0\u2019", "\u00E0"),

    # Double encodings (UTF-8 encoded twice)
    ("ÃƒÂ©", "é"),
    ("ÃƒÂ¨", "è"),
    ("ÃƒÂ ", "à"),
    ("Ãƒ\xa0", "à"),
    ("Ãƒâ‚¬", "À"),
    ("ÃƒÂ¢", "â"),
    ("ÃƒÂª", "ê"),
    ("ÃƒÂ«", "ë"),
    ("ÃƒÂ®", "î"),
    ("ÃƒÂ¯", "ï"),
    ("ÃƒÂ´", "ô"),
    ("ÃƒÂ¶", "ö"),
    ("ÃƒÂ¹", "ù"),
    ("ÃƒÂ»", "û"),
    ("ÃƒÂ¼", "ü"),
    ("ÃƒÂ§", "ç"),
    ("Ãƒâ€°", "É"),
    ("Ã¢â‚¬â„¢", "’"),
    ("Ã¢â‚¬Å“", "“"),
    ("Ã¢â‚¬Â\x9d", "”"),
    ("Ã¢â‚¬Â ", "”"),
    ("Ã¢â‚¬â€œ", "–"),
    ("Ã¢â‚¬â€”", "—"),
    ("Ã¢â‚¬Â¢", "•"),
    ("Ã¢Ëœâ€¦", "★"),

    # Emoji mojibake
    ("ðŸ””", "🔔"),
    ("âš\xa0ï¸\x8f", "⚠️"),
    ("âš\xa0", "⚠️"),
    ("ðŸš¨", "🚨"),
    ("ðŸŽ\x81", "🎁"),
    ("ðŸ“¢", "📢"),
    ("ðŸ›\x8dï¸\x8f", "🛍️"),
    ("ðŸ †", "🏆"),

    # Standard UTF-8 / Windows-1252 mojibake
    ("Ã©", "é"),
    ("Ã¨", "è"),
    ("Ã\xa0", "à"),
    ("Ã¢", "â"),
    ("Ãª", "ê"),
    ("Ã«", "ë"),
    ("Ã®", "î"),
    ("Ã¯", "ï"),
    ("Ã´", "ô"),
    ("Ã¶", "ö"),
    ("Ã¹", "ù"),
    ("Ã»", "û"),
    ("Ã¼", "ü"),
    ("Ã§", "ç"),
    ("Ã€", "À"),
    ("Ã‰", "É"),
    ("Ãˆ", "È"),
    ("ÃŠ", "Ê"),
    ("Ã‹", "Ë"),
    ("Ã‡", "Ç"),
    ("Ã”", "Ô"),
    ("ÃŽ", "Î"),
    ("Ã\x8f", "Ï"),
    ("Ãœ", "Ü"),
    ("Å’", "Œ"),
    ("Å“", "œ"),
    ("â€™", "’"),
    ("â€œ", "“"),
    ("â€\x9d", "”"),
    ("â€ ", "”"),
    ("â€“", "–"),
    ("â€”", "—"),
    ("â€¦", "…"),
    ("â€¢", "•"),
    ("â˜…", "★"),
    ("âœ…", "✅"),
    ("â\x9d\x8c", "❌"),
    ("â Œ", "❌"),
    ("â‚¬", "€"),
    ("Â«", "«"),
    ("Â»", "»"),
    ("Â°", "°"),
    ("Â ", " "),
    ("â•", "═"),
    ("â†’", "→"),
    ("Ãchec", "Échec"),
]

# Replacement character patterns (common French words corrupted with \uFFFD)
FFFD_WORD_FIXES = [
    (r"D\uFFFDgagement", "Dégagement"),
    (r"derri\uFFFDre", "derrière"),
    (r"\uFFFDl\uFFFDment", "élément"),
    (r"s'arr\uFFFDte", "s'arrête"),
    (r"g\uFFFDn\uFFFDr\uFFFD", "générée"),
    (r"g\uFFFDn\uFFFDre", "génère"),
    (r"g\uFFFDn\uFFFDrer", "générer"),
    (r"enregistr\uFFFD(s)?", lambda m: "enregistrés" if m.group(1) else "enregistré"),
    (r"activit\uFFFD(s)?", lambda m: "activités" if m.group(1) else "activité"),
    (r"s\uFFFDlectionn\uFFFD(s)?", lambda m: "sélectionnés" if m.group(1) else "sélectionné"),
    (r"t\uFFFDl\uFFFDcharg\uFFFD(s)?", lambda m: "téléchargés" if m.group(1) else "téléchargé"),
    (r"r\uFFFDinitialis\uFFFD(s)?", lambda m: "réinitialisés" if m.group(1) else "réinitialisé"),
    (r"param\uFFFDtres", "paramètres"),
    (r"modifi\uFFFD(s)?", lambda m: "modifiés" if m.group(1) else "modifié"),
    (r"cr\uFFFD\uFFFD(s)?", lambda m: "créés" if m.group(1) else "créé"),
    (r"supprim\uFFFD(s)?", lambda m: "supprimés" if m.group(1) else "supprimé"),
    (r"d\uFFFDtails", "détails"),
    (r"pr\uFFFDc\uFFFDdent", "précédent"),
    (r"d\uFFFDj\uFFFD", "déjà"),
    (r"\uFFFDchou\uFFFD", "échoué"),
]

TEXT_EXTENSIONS = {
    ".html", ".css", ".js", ".mjs", ".cjs",
    ".ts", ".tsx", ".jsx", ".json", ".md",
    ".txt", ".sql", ".py", ".svg"
}

IGNORE_DIRS = {
    "node_modules", ".git", ".vercel", ".vscode", ".claude", ".cursor",
    "dist", "build", "backups", "logs", "output", "scratch",
    ".playwright-cli", "venv", "__pycache__", ".agents", ".antigravity"
}

# Ignore self and tools that deliberately contain mojibake patterns
IGNORE_FILES = {
    "mojibake_tool.py", "fix_text_encoding.py", "fix-encoding.js",
    "fix-encoding.cjs", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "server_output.txt", "auth_head.txt", "frontend_diff.txt", "temp.html"
}

# Fast pre-filter: if none of these chars appear in the file, it cannot have mojibake
PREFILTER_CHARS = ('Ã', '\uFFFD', 'â', 'ð', 'Å', 'Â')

def decode_safely(raw: bytes) -> tuple[str, str]:
    """Decodes bytes to string safely prioritizing UTF-8 and detecting CP1252 / UTF-16."""
    # Check UTF-16 LE / BE
    if raw.startswith(b"\xff\xfe"):
        return raw.decode("utf-16-le", errors="replace"), "utf-16-le"
    if raw.startswith(b"\xfe\xff"):
        return raw.decode("utf-16-be", errors="replace"), "utf-16-be"

    # Check UTF-8 BOM
    if raw.startswith(b"\xef\xbb\xbf"):
        try:
            return raw[3:].decode("utf-8"), "utf-8-bom"
        except UnicodeDecodeError:
            pass

    # Check valid UTF-8
    try:
        return raw.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        pass

    # Check if file is clean Windows-1252 containing French accents
    try:
        candidate_1252 = raw.decode("cp1252")
        if any(c in candidate_1252 for c in "éèàêëîïôöùûüçÉÈÀÊËÎÏÔÖÙÛÜÇ"):
            return candidate_1252, "cp1252"
    except UnicodeDecodeError:
        pass

    return raw.decode("utf-8", errors="replace"), "utf-8-corrupt"

def scan_file(path: Path) -> tuple[int, list[tuple[int, str, list[str]]], list[str]]:
    """Scans a file for mojibake sequences, wrong encoding, and replacement characters."""
    try:
        raw = path.read_bytes()
    except Exception:
        return 0, [], []

    content, encoding = decode_safely(raw)
    matches_count = 0
    samples = []
    found_keys = set()

    # Flag non-standard encodings that should be UTF-8
    if encoding in ("cp1252", "utf-16-le", "utf-16-be"):
        matches_count += 1
        found_keys.add(f"encoding:{encoding}")
        samples.append((1, f"[File encoded as {encoding.upper()}, should be UTF-8]", [encoding]))

    lines = content.splitlines()

    for idx, line in enumerate(lines, 1):
        line_matches = []
        for bad, _ in REPLACEMENTS_MAP:
            if bad in line:
                line_matches.append(bad)
                found_keys.add(bad)
                matches_count += line.count(bad)
        if "\uFFFD" in line:
            line_matches.append("\uFFFD")
            found_keys.add("\uFFFD")
            matches_count += line.count("\uFFFD")
            
        if line_matches and len(samples) < 5:
            samples.append((idx, line.strip(), line_matches))

    return matches_count, samples, list(found_keys)

def fix_content(content: str) -> tuple[str, int]:
    """Applies all replacements and fixes to a string."""
    fixed = content
    total_fixes = 0

    # 1. Exact string replacements
    for bad, good in REPLACEMENTS_MAP:
        if bad in fixed:
            count = fixed.count(bad)
            fixed = fixed.replace(bad, good)
            total_fixes += count

    # 2. Regex fixes for \uFFFD corrupted words
    for pattern, repl in FFFD_WORD_FIXES:
        fixed, count = re.subn(pattern, repl, fixed, flags=re.IGNORECASE)
        total_fixes += count

    return fixed, total_fixes

def process_file(path: Path, root: Path, do_fix: bool = False) -> tuple[int, bool]:
    """Audit or fix a single file."""
    if path.name in IGNORE_FILES:
        return 0, False
    if path.suffix.lower() not in TEXT_EXTENSIONS:
        return 0, False

    try:
        raw = path.read_bytes()
    except Exception:
        return 0, False

    content, encoding = decode_safely(raw)
    fixed, fix_count = fix_content(content)
    
    # Specific cleanup for rogue byte in disputes.txt
    if path.name == "disputes.txt" and "   <\uFFFD.</p>" in fixed:
        fixed = fixed.replace("   <\uFFFD.</p>", "")
        fix_count += 1

    changed = (fixed != content) or (encoding in ("cp1252", "utf-16-le", "utf-16-be"))

    if do_fix and changed:
        path.write_text(fixed, encoding="utf-8", newline="\n")

    return fix_count, changed

def walk_repo(root: Path):
    """Walks the repository files fast using git ls-files if available, else targeted dirs."""
    import subprocess
    try:
        proc = subprocess.run(
            ["git", "ls-files"],
            cwd=str(root),
            capture_output=True,
            text=True,
            check=True
        )
        for line in proc.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            p = root / line
            if any(part in IGNORE_DIRS for part in p.parts):
                continue
            if p.suffix.lower() in TEXT_EXTENSIONS and p.name not in IGNORE_FILES and p.is_file():
                yield p
        return
    except Exception:
        pass

    # Fallback: scan targeted directories only
    target_dirs = ["frontend", "backend", "supabase", "scripts", "tools", "docs", "database", "api"]
    for tdir in target_dirs:
        base = root / tdir
        if not base.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
            for f in filenames:
                p = Path(dirpath) / f
                if p.suffix.lower() in TEXT_EXTENSIONS and p.name not in IGNORE_FILES:
                    yield p

def main():
    parser = argparse.ArgumentParser(description="Audit and fix Mojibake / encoding errors.")
    parser.add_argument("--fix", action="store_true", help="Apply fixes to files")
    parser.add_argument("--path", type=str, default=".", help="Root path to scan")
    parser.add_argument("--json", action="store_true", help="Output summary in JSON")
    args = parser.parse_args()

    root = Path(args.path).resolve()
    print(f"=== {'FIXING' if args.fix else 'AUDITING'} MOJIBAKE & ENCODING ===")
    print(f"Target root: {root}\n")

    files_with_issues = []
    total_issues = 0
    files_fixed = 0

    for file_path in walk_repo(root):
        count, samples, keys = scan_file(file_path)
        if count > 0:
            rel = file_path.relative_to(root)
            files_with_issues.append((rel, count, samples, keys, file_path))
            total_issues += count

    files_with_issues.sort(key=lambda x: x[1], reverse=True)

    print(f"Audit Results:")
    print(f"- Total files inspected with issues: {len(files_with_issues)}")
    print(f"- Total corrupted sequences detected: {total_issues}\n")

    if files_with_issues:
        print("Top affected files:")
        for rel, count, samples, keys, _ in files_with_issues[:20]:
            print(f"  • {rel} ({count} issues)")
            for lno, text, m in samples[:2]:
                preview = (text[:80] + "...") if len(text) > 80 else text
                print(f"      L{lno}: {preview}")
        if len(files_with_issues) > 20:
            print(f"  ... and {len(files_with_issues) - 20} more files.")
        print()

    if args.fix:
        print("Applying fixes across all affected files...")
        for rel, count, samples, keys, full_path in files_with_issues:
            _, changed = process_file(full_path, root, do_fix=True)
            if changed:
                files_fixed += 1

        print(f"\n[DONE] Successfully corrected {files_fixed} files to clean UTF-8.")
        
        # Re-check after fix
        remaining_issues = 0
        remaining_files = []
        for file_path in walk_repo(root):
            count, samples, keys = scan_file(file_path)
            if count > 0:
                rel = file_path.relative_to(root)
                remaining_files.append((rel, count, samples))
                remaining_issues += count

        print(f"\nVerification post-fix:")
        print(f"- Remaining issues: {remaining_issues}")
        if remaining_issues > 0:
            print(f"- Remaining files with non-standard sequences ({len(remaining_files)}):")
            for rel, count, samples in remaining_files[:10]:
                print(f"  • {rel} ({count} remaining)")
                for lno, text, m in samples[:2]:
                    print(f"      L{lno}: {text[:80]}")
    else:
        print("To fix all these issues automatically, run:")
        print("  python tools/encoding-check/mojibake_tool.py --fix")

    return 1 if (not args.fix and total_issues > 0) else 0

if __name__ == "__main__":
    sys.exit(main())
