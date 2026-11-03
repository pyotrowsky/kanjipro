"""Generate normal binary PWA icons for the approved Shiba Inu artwork.

GitHub file integrations here accept UTF-8 text, so source PNG bytes live in
ASCII base64 files. This script decodes them during GitHub Pages deployment.
No Pillow or internet connection is required.
"""
from __future__ import annotations

import base64
import binascii
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "assets" / "pwa-icons"
SIZES = {
    "icon-192": (192, 192),
    "icon-512": (512, 512),
    "icon-maskable-512": (512, 512),
    "apple-touch-icon": (180, 180),
}
PNG_SIGNATURE = bytes((137, 80, 78, 71, 13, 10, 26, 10))


def install_icons(destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for name, expected in SIZES.items():
        try:
            raw = (SOURCES / (name + ".b64")).read_text(encoding="ascii").strip()
            png = base64.b64decode(raw, validate=True)
        except (OSError, binascii.Error, ValueError) as exc:
            raise ValueError(f"Cannot decode Shiba icon {name}") from exc
        if len(png) < 32 or png[:8] != PNG_SIGNATURE or png[12:16] != b"IHDR":
            raise ValueError(f"Invalid PNG file for {name}")
        dimensions = struct.unpack(">II", png[16:24])
        if dimensions != expected:
            raise ValueError(f"Incorrect icon dimensions: {name} is {dimensions}, expected {expected}")
        (destination / (name + ".png")).write_bytes(png)
        print(f"Installed {name}.png ({dimensions[0]}x{dimensions[1]})")


if __name__ == "__main__":
    install_icons(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_site" / "icons")
