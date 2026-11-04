#!/usr/bin/env python3
"""
Builds App Store screenshots from raw iPhone 17 Pro Max simulator captures.

  store/source-ios/<name>.png              raw 1320x2868 captures of the real app (demo data)
  store/screenshots/ios-6.9/NN-*.png       1320x2868  iPhone 6.9"
  store/screenshots/ios-6.3/NN-*.png       1206x2622  iPhone 6.3"

Run:  python3 store/build_screenshots_ios.py      (needs Google Chrome and ImageMagick)
Same headlines, gradients and tiles as the Play set (PANELS in build_screenshots.py).
"""
import subprocess
import tempfile
from pathlib import Path

from build_screenshots import FONT, PANELS, data_uri, render

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source-ios"
OUT = ROOT / "screenshots"
W, H = 1320, 2868
SCALE = W / 1080  # the tile positions in PANELS were authored for a 1080-wide panel


def html_for(p: dict) -> str:
    c1, c2 = p["bg"]
    phone_w = 1000
    phone_h = int(phone_w * H / W)
    floats = "".join(
        f'<div class="tile" style="left:{int(x * SCALE)}px;top:{int(y * SCALE)}px;'
        f'font-size:{int(s * SCALE)}px;transform:rotate({r}deg)">{e}</div>'
        for e, s, x, y, r in p["floats"]
    )
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
{FONT}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:{W}px;height:{H}px;overflow:hidden;background:#000}}
.panel{{position:relative;width:{W}px;height:{H}px;overflow:hidden;
  background:linear-gradient(160deg,{c1} 0%,{c2} 100%);font-family:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif}}
.blob{{position:absolute;border-radius:50%;background:rgba(255,255,255,.09)}}
.b1{{width:920px;height:920px;left:-320px;top:380px}}
.b2{{width:760px;height:760px;right:-270px;top:-150px;background:rgba(255,255,255,.07)}}
.b3{{width:640px;height:640px;right:-200px;bottom:-170px}}
h1{{position:absolute;left:0;right:0;top:170px;text-align:center;color:#fff;
  font-weight:800;font-size:112px;line-height:1.08;letter-spacing:-2.5px;text-shadow:0 4px 18px rgba(0,0,0,.12)}}
.sub{{position:absolute;left:70px;right:70px;top:490px;text-align:center;color:rgba(255,255,255,.9);
  font-weight:600;font-size:52px;line-height:1.25;letter-spacing:-.3px}}
.phone{{position:absolute;left:{(W - phone_w) // 2}px;top:700px;width:{phone_w}px;height:{phone_h}px;
  border-radius:136px;background:#0e0e14;padding:18px;
  box-shadow:0 48px 110px rgba(10,8,60,.45),0 0 0 3px rgba(255,255,255,.08) inset;
  transform:rotate({p['tilt']}deg);transform-origin:50% 0%}}
.screen{{width:100%;height:100%;border-radius:120px;overflow:hidden;background:#fff}}
.screen img{{width:100%;height:100%;display:block}}
.tile{{position:absolute;width:184px;height:184px;border-radius:46px;background:#fff;
  display:flex;align-items:center;justify-content:center;box-shadow:0 24px 54px rgba(20,14,90,.28)}}
</style></head><body><div class="panel">
  <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
  <h1>{p['title']}</h1>
  <div class="sub">{p['sub']}</div>
  <div class="phone"><div class="screen"><img src="{data_uri(SOURCE / (p['src'] + '.png'))}"></div></div>
  {floats}
</div></body></html>"""


def main() -> None:
    large, medium = OUT / "ios-6.9", OUT / "ios-6.3"
    large.mkdir(parents=True, exist_ok=True)
    medium.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for p in PANELS:
            page = Path(tmp) / f"{p['file']}.html"
            page.write_text(html_for(p), encoding="utf-8")
            out = large / f"{p['file']}.png"
            render(page, out, W, H, 1)
            # App Store Connect rejects images with an alpha channel.
            subprocess.run(["magick", str(out), "-alpha", "off", "-depth", "8", "-define", "png:color-type=2", str(out)], check=True)
            subprocess.run(["magick", str(out), "-filter", "Lanczos", "-resize", "1206x2622!", "-alpha", "off", "-depth", "8",
                            "-define", "png:color-type=2", str(medium / out.name)], check=True)
            print("wrote", out.name)


if __name__ == "__main__":
    main()
