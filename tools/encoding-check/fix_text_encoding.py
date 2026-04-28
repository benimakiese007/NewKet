from __future__ import annotations

from pathlib import Path


def replace_between(text: str, start_marker: str, end_marker: str, replacement: str) -> tuple[str, bool]:
    start = text.find(start_marker)
    if start == -1:
        return text, False
    mid_start = start + len(start_marker)
    mid_end = text.find(end_marker, mid_start)
    if mid_end == -1:
        return text, False
    return text[:mid_start] + replacement + text[mid_end:], True


def main() -> int:
    root = Path(__file__).resolve().parents[2]

    # 1) Fix common double-encoded byte sequences by operating on bytes.
    byte_maps: list[tuple[bytes, bytes]] = [
        (b"\xc3\x83\xc2\xa9", "é".encode("utf-8")),
        (b"\xc3\x83\xc2\xa8", "è".encode("utf-8")),
        (b"\xc3\x83\xc2\xa0", "à".encode("utf-8")),
        (b"\xc3\x83\xc2\xa7", "ç".encode("utf-8")),
        (b"\xc3\x83\xc2\x89", "É".encode("utf-8")),
        (b"\xc3\x83\xe2\x80\xb0", "É".encode("utf-8")),  # Ã‰ -> É (alternate mojibake)
        (b"\xc3\x83\xc2\xaa", "ê".encode("utf-8")),
        (b"\xc3\x83\xc2\xb4", "ô".encode("utf-8")),
        # Smart punctuation / dashes commonly mojibaked.
        (b"\xc3\xa2\xe2\x82\xac\xe2\x80\x9d", "—".encode("utf-8")),  # â€” -> —
        (b"\xc3\xa2\xe2\x82\xac\xe2\x80\x99", "’".encode("utf-8")),  # â€™ -> ’
        (b"\xc3\xb0\xc5\xb8\xc5\xa1\xe2\x82\xac", "🚀".encode("utf-8")),  # ðŸš€ -> 🚀
    ]

    targets_bytes = [
        root / "frontend" / "src" / "pages" / "product.html",
        root / "frontend" / "src" / "pages" / "catalog.html",
        root / "backend" / "src" / "controllers" / "payment.controller.js",
        root / "backend" / "src" / "server.js",
    ]

    for path in targets_bytes:
        if not path.exists():
            continue
        before = path.read_bytes()
        after = before
        for a, b in byte_maps:
            after = after.replace(a, b)
        if after != before:
            path.write_bytes(after)
            print(f"fixed-bytes: {path.relative_to(root)}")

    # 2) Fix a known broken icon string in customer dashboard (text-level replace).
    customer_dashboard = root / "frontend" / "src" / "pages" / "customer-dashboard.html"
    if customer_dashboard.exists():
        text = customer_dashboard.read_text(encoding="utf-8", errors="strict")
        changed = False

        # Replace icon literal between markers (avoid depending on the current broken bytes).
        text, did = replace_between(
            text,
            "cls = 'status-vip'; icon = '",
            "'; label = 'VIP'",
            "★",
        )
        changed = changed or did

        text, did = replace_between(
            text,
            "cls = 'status-premium'; icon = '",
            "'; label = 'Premium'",
            "🏆",
        )
        changed = changed or did

        if changed:
            customer_dashboard.write_text(text, encoding="utf-8", newline="\n")
            print(f"fixed-text: {customer_dashboard.relative_to(root)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
