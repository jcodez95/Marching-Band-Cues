"""
Generates Cuesheet app icons: a dark rounded-square backdrop with an amber
"cue mark" motif (a play triangle + a tick, echoing a timeline marker).
Produces maskable + standard PWA icons and an iOS apple-touch-icon.
"""
from PIL import Image, ImageDraw

BG = (21, 22, 26, 255)        # --color-bg
ACCENT = (232, 163, 61, 255)  # --color-accent (VU-meter amber)
ACCENT_DIM = (169, 119, 41, 255)

def draw_icon(size, padding_ratio=0.0):
    """Draw the icon at `size` px. padding_ratio adds safe-zone margin (for maskable)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(size * padding_ratio)
    inner = size - 2 * pad

    # Background: rounded square (or full bleed square for maskable safe zone)
    radius = int(inner * 0.22)
    draw.rounded_rectangle(
        [pad, pad, pad + inner, pad + inner],
        radius=radius,
        fill=BG,
    )

    cx, cy = size / 2, size / 2

    # Play triangle (slightly left of center), representing playback
    tri_h = inner * 0.34
    tri_w = tri_h * 0.85
    tri_cx = cx - inner * 0.10
    p1 = (tri_cx - tri_w / 2, cy - tri_h / 2)
    p2 = (tri_cx - tri_w / 2, cy + tri_h / 2)
    p3 = (tri_cx + tri_w / 2, cy)
    draw.polygon([p1, p2, p3], fill=ACCENT)

    # Timeline tick / cue marker: a vertical bar + small flag, to the right
    tick_x = cx + inner * 0.22
    tick_w = inner * 0.045
    tick_h = inner * 0.40
    draw.rounded_rectangle(
        [tick_x - tick_w / 2, cy - tick_h / 2, tick_x + tick_w / 2, cy + tick_h / 2],
        radius=tick_w / 2,
        fill=ACCENT,
    )
    # small dot flag at top of tick
    dot_r = inner * 0.05
    draw.ellipse(
        [tick_x - dot_r, cy - tick_h / 2 - dot_r * 1.6,
         tick_x + dot_r, cy - tick_h / 2 + dot_r * 0.4],
        fill=ACCENT_DIM,
    )

    return img


# Standard + maskable icons (maskable gets extra safe-zone padding)
sizes = {
    "icon-192.png": (192, 0.0),
    "icon-512.png": (512, 0.0),
    "icon-maskable-192.png": (192, 0.14),
    "icon-maskable-512.png": (512, 0.14),
    "apple-touch-icon.png": (180, 0.0),
}

for filename, (px, pad) in sizes.items():
    icon = draw_icon(px, pad)
    # apple-touch-icon should NOT be transparent (iOS renders alpha oddly) — flatten onto bg
    if filename == "apple-touch-icon.png":
        flat = Image.new("RGBA", icon.size, BG)
        flat.alpha_composite(icon)
        flat.convert("RGB").save(f"icons/{filename}")
    else:
        icon.save(f"icons/{filename}")
    print(f"wrote icons/{filename} ({px}x{px})")

# Favicon
favicon = draw_icon(64, 0.0)
favicon.save("icons/favicon.png")
print("wrote icons/favicon.png (64x64)")
