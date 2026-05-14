from __future__ import annotations

from pathlib import Path

# This script fixes common mojibake sequences found in the repo and rewrites
# matching text files as strict UTF-8.

REPLACEMENTS: dict[str, str] = {
    # Extra mojibake observed in pages/dashboards (kept as Unicode escapes).
    "\u00C3\u0082\u00C2\u00A9": "\u00A9",  # ???? -> ?
    "\u00C3\u0082\u00C2\u00B7": "\u00B7",  # ???? -> ?
    "\u00C3\u0085\u201C": "\u0153",  # ??? -> ?
    "\u00C3\u2026\u201C": "\u0153",  # ??? (alt) -> ?
    "\u00C3\u0083\u00C5\u00A0": "\u00CA",  # ???? -> ?
    "\u00C3\u0083\u00CB\u02C6": "\u00C8",  # ???? -> ?

    # Variants seen in some HTML after mixed cp1252/utf-8 conversions.
    "\u00C3\u201A\u00C2\u00A9": "\u00A9",  # Ã‚© -> ©
    "\u00C3\u201A\u00C2\u00B7": "\u00B7",  # Ã‚· -> ·
    "\u00C3\u0192\u00C5\u00A0": "\u00CA",  # ÃŠ -> Ê
    "\u00C3\u0192\u00CB\u2020": "\u00C8",  # Ãˆ -> È
    "\u00E2\u00E2\u20AC\u00A0\u2019": "\u00E0",  # ââ€ ’ -> à


    # Double-encoded sequences that appear in some HTML titles/text.
    "ÃƒÂ©": "Ã©",
    "ÃƒÂ¨": "Ã¨",
    "Ãƒ ": "Ã ",
    "Ãƒâ‚¬": "Ã€",
    "ÃƒÂ¢": "Ã¢",
    "ÃƒÂª": "Ãª",
    "ÃƒÂ«": "Ã«",
    "ÃƒÂ®": "Ã®",
    "ÃƒÂ¯": "Ã¯",
    "ÃƒÂ´": "Ã´",
    "ÃƒÂ¶": "Ã¶",
    "ÃƒÂ¹": "Ã¹",
    "ÃƒÂ»": "Ã»",
    "ÃƒÂ¼": "Ã¼",
    "ÃƒÂ§": "Ã§",
    "Ã¢â‚¬â„¢": "â€™",
    "Ã¢â‚¬Å“": "â€œ",
    "Ã¢â‚¬Â": "â€",
    "Ã¢â‚¬â€œ": "â€“",
    "Ã¢â‚¬â€": "â€”",
    "Ã¢â‚¬Â¢": "â€¢",
    "Ã¢Ëœâ€¦": "â˜…",

    # Emoji mojibake (C1 controls show up in Vite/parse5 warnings).
    "ðŸ””": "🔔",
    "âš\xa0ï¸\x8f": "⚠️",
    "ðŸš¨": "🚨",
    "ðŸŽ\x81": "🎁",
    "ðŸ“¢": "📢",
    "ðŸ›\x8dï¸\x8f": "🛍️",
    "ðŸ†": "🏆",

    # Canonical UTF-8 characters.
    "Ã€": "À",
    "Ã‰": "É",
    "Ã©": "é",
    "Ã¨": "è",
    "Ã ": "à",
    "Ã¢": "â",
    "Ãª": "ê",
    "Ã«": "ë",
    "Ã®": "î",
    "Ã¯": "ï",
    "Ã´": "ô",
    "Ã¶": "ö",
    "Ã¹": "ù",
    "Ã»": "û",
    "Ã¼": "ü",
    "Ã§": "ç",
    "â€™": "’",
    "â€œ": "“",
    "â€": "”",
    "â€“": "–",
    "â€”": "—",
    "â€¢": "•",
    "â˜…": "★",
    "âœ…": "✅",
    "âŒ": "❌",
}

TEXT_EXTENSIONS = {
    ".html",
    ".css",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".json",
    ".md",
    ".txt",
    ".env",
}


def _looks_texty(path: Path) -> bool:
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    if path.name.upper() in {"README", "LICENSE"}:
        return True
    return False


def fix_text_file(path: Path, root: Path) -> bool:
    if not path.exists() or not path.is_file():
        return False
    if not _looks_texty(path):
        return False

    raw = path.read_bytes()
    if not raw:
        return False

    had_utf8_bom = raw.startswith(b"\xef\xbb\xbf")
    if had_utf8_bom:
        raw = raw[3:]

    decoded: str | None = None
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            decoded = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if decoded is None:
        decoded = raw.decode("utf-8", errors="replace")

    text = decoded
    fixed = text
    for wrong, right in REPLACEMENTS.items():
        fixed = fixed.replace(wrong, right)

    if fixed == text and not had_utf8_bom:
        return False

    path.write_text(fixed, encoding="utf-8", newline="\n")
    print(f"fixed-text: {path.relative_to(root)}")
    return True


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    search_roots = [
        root,
        root / "frontend",
        root / "backend",
        root / "api",
        root / "docs",
        root / "database",
    ]

    ignore_dirs = {"node_modules", "dist", ".git", ".vercel", ".vscode"}

    for base in search_roots:
        if not base.exists():
            continue
        if base.is_file():
            fix_text_file(base, root)
            continue
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            if any(part in ignore_dirs for part in path.parts):
                continue
            fix_text_file(path, root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
