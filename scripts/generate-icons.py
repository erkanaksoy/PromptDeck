from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "public" / "icons"
DESKTOP_ICON_DIR = ROOT / "apps" / "desktop" / "src-tauri" / "icons"


def render(size: int) -> None:
    scale = size / 128
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    def box(coords, radius, fill):
        draw.rounded_rectangle(tuple(round(value * scale) for value in coords), radius=round(radius * scale), fill=fill)

    box((0, 0, 128, 128), 30, "#654dda")
    box((22, 25, 106, 86), 12, "#3d2ca4")
    box((16, 34, 112, 103), 13, "#ffffff")
    box((27, 47, 48, 89), 6, "#61a8ff")
    box((54, 47, 75, 89), 6, "#ffc267")
    box((81, 47, 101, 89), 6, "#58ceb1")
    radius = max(1, round(3.5 * scale))
    for x in (37.5, 64.5, 91):
        cx, cy = round(x * scale), round(57.5 * scale)
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill="#ffffff")
    image.save(ICON_DIR / f"icon-{size}.png", optimize=True)


for icon_size in (16, 32, 48, 128):
    render(icon_size)

DESKTOP_ICON_DIR.mkdir(parents=True, exist_ok=True)
desktop_source = Image.open(ICON_DIR / "icon-128.png").convert("RGBA")
desktop_source.save(DESKTOP_ICON_DIR / "icon.png", optimize=True)
desktop_source.save(
    DESKTOP_ICON_DIR / "icon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128)],
)
