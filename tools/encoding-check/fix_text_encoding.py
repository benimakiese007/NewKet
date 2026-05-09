from __future__ import annotations

from pathlib import Path

REPLACEMENTS = {
    "Ã©": "é",
    "Ã¨": "è",
    "Ã ": "à",
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
}


def fix_text_file(path: Path, root: Path) -> bool:
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8", errors="ignore")
    fixed = text
    for wrong, right in REPLACEMENTS.items():
        fixed = fixed.replace(wrong, right)
    if fixed == text:
        return False
    path.write_text(fixed, encoding="utf-8", newline="\n")
    print(f"fixed-text: {path.relative_to(root)}")
    return True


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    targets = [
        root / "README.md",
        root / "README.TXT",
        root / "frontend" / ".env.example",
        root / "frontend" / "src" / "pages" / "404.html",
        root / "frontend" / "src" / "pages" / "achat.html",
        root / "frontend" / "src" / "pages" / "customer-dashboard.html",
        root / "frontend" / "src" / "pages" / "login.html",
        root / "frontend" / "src" / "pages" / "product.html",
        root / "backend" / "src" / "controllers" / "payment.controller.js",
        root / "backend" / "src" / "services" / "order-workflow.js",
    ]
    for target in targets:
        fix_text_file(target, root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
