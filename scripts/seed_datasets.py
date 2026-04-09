#!/usr/bin/env python3
"""
seed_datasets.py — Populate sample image datasets for development and demos.

Creates placeholder PNG images in data/datasets/{subject}/ using PIL so the
app is immediately usable without manually sourcing images.

Usage:
    python scripts/seed_datasets.py
    python scripts/seed_datasets.py --full    # download real images from Wikimedia
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Add repo root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

DATA_DIR = Path(__file__).parent.parent / "data" / "datasets"

# ── Placeholder images via PIL ────────────────────────────────────────────────

DATASETS: dict[str, list[tuple[str, str, str]]] = {
    "science": [
        ("photosynthesis.png",   "#22c55e", "Photosynthesis"),
        ("water_cycle.png",      "#3b82f6", "Water Cycle"),
        ("solar_system.png",     "#1e1b4b", "Solar System"),
        ("human_cell.png",       "#ec4899", "Human Cell"),
        ("food_chain.png",       "#f59e0b", "Food Chain"),
        ("animal_adaptations.png","#14b8a6", "Animal Adaptations"),
    ],
    "geography": [
        ("world_map.png",        "#0ea5e9", "World Map"),
        ("continents.png",       "#6366f1", "Continents"),
        ("mountain_ranges.png",  "#a16207", "Mountain Ranges"),
        ("ocean_currents.png",   "#0891b2", "Ocean Currents"),
        ("climate_zones.png",    "#f97316", "Climate Zones"),
    ],
    "history": [
        ("ancient_egypt.png",    "#d97706", "Ancient Egypt"),
        ("medieval_castle.png",  "#64748b", "Medieval Castle"),
        ("industrial_revolution.png", "#78716c", "Industrial Revolution"),
        ("world_war_2.png",      "#374151", "World War 2"),
        ("roman_colosseum.png",  "#a16207", "Roman Colosseum"),
    ],
    "math": [
        ("geometric_shapes.png", "#8b5cf6", "Geometric Shapes"),
        ("fractions.png",        "#ec4899", "Fractions"),
        ("coordinate_plane.png", "#06b6d4", "Coordinate Plane"),
        ("multiplication_table.png", "#f59e0b", "Multiplication Table"),
    ],
    "art": [
        ("color_wheel.png",      "#f43f5e", "Color Wheel"),
        ("perspective_drawing.png", "#64748b", "Perspective Drawing"),
        ("famous_paintings.png", "#a78bfa", "Famous Paintings"),
    ],
}


def create_placeholder_image(path: Path, color: str, label: str) -> None:
    """Create a simple colored PNG with a text label using PIL."""
    try:
        from PIL import Image, ImageDraw, ImageFont

        img = Image.new("RGB", (400, 300), color=color)
        draw = ImageDraw.Draw(img)

        # White semi-transparent rectangle in center
        draw.rectangle([50, 90, 350, 210], fill=(255, 255, 255, 200))

        # Label text
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
        except Exception:
            font = ImageFont.load_default()

        # Center text
        bbox = draw.textbbox((0, 0), label, font=font)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (400 - w) // 2
        y = (300 - h) // 2
        draw.text((x, y), label, fill=color, font=font)

        img.save(path, "PNG")
        print(f"  Created: {path.relative_to(path.parent.parent.parent.parent)}")

    except ImportError:
        # PIL not available — create a minimal 1x1 pixel PNG
        import struct, zlib

        def make_png(r: int, g: int, b: int) -> bytes:
            def chunk(name: bytes, data: bytes) -> bytes:
                c = struct.pack(">I", len(data)) + name + data
                return c + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)

            header = b"\x89PNG\r\n\x1a\n"
            ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            raw = b"\x00" + bytes([r, g, b])
            idat = chunk(b"IDAT", zlib.compress(raw))
            iend = chunk(b"IEND", b"")
            return header + ihdr + idat + iend

        path.write_bytes(make_png(128, 128, 200))
        print(f"  Created minimal PNG: {path.name}")


def seed_placeholder_images():
    print("Seeding placeholder images …\n")
    for subject, images in DATASETS.items():
        folder = DATA_DIR / subject
        folder.mkdir(parents=True, exist_ok=True)
        print(f"[{subject}]")
        for filename, color, label in images:
            dest = folder / filename
            if not dest.exists():
                create_placeholder_image(dest, color, label)
            else:
                print(f"  Skipped (exists): {filename}")
    print("\nDone! Images are in data/datasets/")


def seed_real_images():
    """Download sample images from Wikimedia Commons (requires httpx)."""
    try:
        import httpx
    except ImportError:
        print("httpx not installed. Run: pip install httpx")
        return

    WIKIMEDIA_IMAGES = [
        ("science/photosynthesis.svg",
         "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Photosynthesis_equation.svg/640px-Photosynthesis_equation.svg.png"),
    ]

    for dest_rel, url in WIKIMEDIA_IMAGES:
        dest = DATA_DIR / dest_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            print(f"  Skipped (exists): {dest_rel}")
            continue
        try:
            resp = httpx.get(url, follow_redirects=True, timeout=30)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            print(f"  Downloaded: {dest_rel}")
        except Exception as e:
            print(f"  Failed {dest_rel}: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Teacher-Z datasets")
    parser.add_argument("--full", action="store_true", help="Download real images")
    args = parser.parse_args()

    if args.full:
        seed_real_images()
    else:
        seed_placeholder_images()
