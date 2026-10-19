#!/usr/bin/env python3
"""
Renders every Mentto icon from one vector design (an "M" with a reminder dot on indigo).

  assets/icon.png                      1024  full-bleed app icon (also the Play icon master)
  assets/android-icon-foreground.png   1024  adaptive icon foreground (mark only, transparent)
  assets/android-icon-background.png   1024  adaptive icon background (gradient)
  assets/android-icon-monochrome.png    432  themed icon (white mark, transparent)
  assets/notification-icon.png           96  status bar icon (white silhouette, transparent)
  assets/splash-icon.png               1024  rounded icon for the splash screen (transparent corners)
  assets/favicon.png                     48  web favicon
  store/icon-512.png                    512  Play Console icon

Run:  python3 store/build_icons.py      (needs Google Chrome for headless rendering)
"""
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Brand colours (src/theme/tokens.ts): primary indigo, with the amber used for fees and reminders.
INDIGO_LIGHT, INDIGO, INDIGO_DEEP, AMBER = "#6D66F5", "#4F46E5", "#3B32C9", "#FBBF24"

# The mark, on a 1024 canvas: a rounded "M" and a dot at its top-right like a notification badge.
M_PATH = "M 322 700 L 322 352 L 512 566 L 702 352 L 702 700"
DOT = (746, 300, 70)


def background(rounded: bool = False) -> str:
    radius = 'rx="232"' if rounded else ""
    return f"""
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{INDIGO_LIGHT}"/>
      <stop offset="0.55" stop-color="{INDIGO}"/>
      <stop offset="1" stop-color="{INDIGO_DEEP}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.28" cy="0.2" r="0.75">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" {radius} fill="url(#bg)"/>
  <rect width="1024" height="1024" {radius} fill="url(#glow)"/>"""


def mark(color: str = "#FFFFFF", dot: str = AMBER, ring: str | None = INDIGO, scale: float = 1.0) -> str:
    """The M and its dot. With ring=None the gap around the dot is cut out of the M, so whatever is
    behind it shows through; otherwise the gap is painted in that colour."""
    cx, cy, r = DOT
    t = f'transform="translate(512 512) scale({scale}) translate(-512 -512)"'
    if ring is None:
        # Silhouette: cut the gap out of the M with a mask so the shape stays one colour.
        return f"""
  <defs><mask id="gap" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="white"/>
    <circle cx="{cx}" cy="{cy}" r="{r + 30}" fill="black"/></mask></defs>
  <g {t}>
    <path d="{M_PATH}" fill="none" stroke="{color}" stroke-width="116" stroke-linecap="round"
      stroke-linejoin="round" mask="url(#gap)"/>
    <circle cx="{cx}" cy="{cy}" r="{r}" fill="{dot}"/>
  </g>"""
    return f"""
  <g {t}>
    <path d="{M_PATH}" fill="none" stroke="{color}" stroke-width="116" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="{cx}" cy="{cy}" r="{r + 26}" fill="{ring}"/>
    <circle cx="{cx}" cy="{cy}" r="{r}" fill="{dot}"/>
  </g>"""


def svg(body: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">{body}</svg>'


# name -> (svg, output size)
# Launchers crop adaptive icons to shapes as small as a circle of 66% of the canvas, so the
# adaptive layers keep the mark inside that safe zone.
ADAPTIVE = 0.8

ICONS = {
    "assets/icon.png": (svg(background() + mark(ring=None)), 1024),
    "assets/android-icon-background.png": (svg(background()), 1024),
    "assets/android-icon-foreground.png": (svg(mark(ring=None, scale=ADAPTIVE)), 1024),
    "assets/android-icon-monochrome.png": (svg(mark(ring=None, dot="#FFFFFF", scale=ADAPTIVE)), 432),
    "assets/notification-icon.png": (svg(mark(ring=None, dot="#FFFFFF", scale=1.7)), 96),
    "assets/splash-icon.png": (svg(background(rounded=True) + mark(ring=None)), 1024),
    "assets/favicon.png": (svg(background(rounded=True) + mark(ring=None)), 48),
    "store/icon-512.png": (svg(background() + mark(ring=None)), 512),
}


def render(markup: str, out: Path, size: int, tmp: Path) -> None:
    page = tmp / (out.stem + ".html")
    page.write_text(
        f"""<!doctype html><html><head><style>
html,body{{margin:0;width:{size}px;height:{size}px;overflow:hidden;background:transparent}}
svg{{display:block;width:{size}px;height:{size}px}}</style></head><body>{markup}</body></html>""",
        encoding="utf-8",
    )
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
         "--force-device-scale-factor=1", f"--window-size={size},{size}", f"--screenshot={out}", page.as_uri()],
        check=True, capture_output=True,
    )


def main() -> None:
    (ROOT / "assets" / "brand").mkdir(parents=True, exist_ok=True)
    (ROOT / "assets" / "brand" / "icon.svg").write_text(ICONS["assets/icon.png"][0], encoding="utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        for name, (markup, size) in ICONS.items():
            out = ROOT / name
            out.parent.mkdir(parents=True, exist_ok=True)
            render(markup, out, size, Path(tmp))
            print("wrote", name, f"{size}x{size}")


if __name__ == "__main__":
    main()
