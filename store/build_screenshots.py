#!/usr/bin/env python3
"""
Builds Google Play listing screenshots and the feature graphic from raw emulator captures.

  store/source/<name>.png                  raw 1080x2424 captures of the real app (demo data)
  store/screenshots/phone/NN-*.png         1080x1920  phone
  store/screenshots/tablet-7in/NN-*.png    1200x1920  7-inch tablet
  store/screenshots/tablet-10in/NN-*.png   1600x2560  10-inch tablet
  store/feature-graphic-1024x500.png       Play feature graphic

Run:  python3 store/build_screenshots.py      (needs Google Chrome for headless rendering)
Same layout as Huffle's listing: headline, gradient, tilted device frame, floating tiles.
"""
import base64
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source"
OUT = ROOT / "screenshots"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# (folder, design width, design height, device scale factor -> output pixels)
TARGETS = [
    ("phone", 1080, 1920, 1.0),
    ("tablet-7in", 1200, 1920, 1.0),
    ("tablet-10in", 1200, 1920, 4 / 3),
]
BASE_W = 1080  # x-positions of the floating tiles were authored for this width

# Brand palette (src/theme/tokens.ts)
INDIGO_LT, INDIGO, INDIGO_DK, VIOLET, AMBER = "#6D66F5", "#4F46E5", "#3B32C9", "#7C5CF0", "#FBBF24"

PANELS = [
    dict(file="01-today", src="today", title="Your teaching day,<br>at a glance",
         sub="Lessons, attendance and fees owed.", bg=(INDIGO_LT, INDIGO_DK), tilt=-4,
         floats=[("🗓️", 70, 905, 560, -12), ("🎵", 60, 15, 1180, 10)]),
    dict(file="02-schedule", src="schedule", title="Every lesson<br>in its place",
         sub="Weekly slots, extra lessons, group classes.", bg=(VIOLET, INDIGO), tilt=4,
         floats=[("⏰", 70, 10, 660, -10), ("📚", 64, 925, 1100, 12)]),
    dict(file="03-attendance", src="attendance", title="Attendance<br>in a tap",
         sub="Tick who came. Fees update on their own.", bg=(INDIGO, INDIGO_DK), tilt=-3,
         floats=[("✅", 72, 905, 620, 12), ("👩‍🎓", 64, 10, 1150, -10)]),
    dict(file="04-student", src="student", title="Everything about<br>each student",
         sub="Contacts, lessons, payments and reminders.", bg=(INDIGO_LT, VIOLET), tilt=3,
         floats=[("📞", 66, 10, 700, -10), ("🎹", 70, 925, 1080, 12)]),
    dict(file="05-fees", src="fees", title="Know who’s paid<br>and who hasn’t",
         sub="Overdue, due today and coming up.", bg=(VIOLET, INDIGO_DK), tilt=-4,
         floats=[("💵", 74, 905, 600, 12), ("🔔", 60, 10, 1150, -10)]),
    dict(file="06-fee-plans", src="plan", title="Monthly, per term<br>or per lesson",
         sub="Set a fee once. Mentto does the maths.", bg=(INDIGO, VIOLET), tilt=4,
         floats=[("📝", 70, 10, 700, -12), ("💳", 64, 925, 1060, 10)]),
    dict(file="07-students", src="students", title="One-to-one<br>or whole classes",
         sub="Students and groups, side by side.", bg=(INDIGO_DK, INDIGO), tilt=-3,
         floats=[("🎤", 70, 905, 640, 10), ("👥", 64, 10, 1100, -10)]),
    dict(file="08-reminders", src="settings", title="Reminders<br>your way",
         sub="Before each lesson, and when fees fall due.", bg=(INDIGO_LT, INDIGO), tilt=3,
         floats=[("🔔", 74, 905, 600, 12), ("⏰", 66, 10, 1100, -10)]),
]

FONT = "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');"


def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def html_for(p: dict, W: int, H: int) -> str:
    shot = data_uri(SOURCE / f"{p['src']}.png")
    c1, c2 = p["bg"]
    phone_w = 780
    phone_h = int(phone_w * 2424 / 1080)
    shift = W - BASE_W
    floats = "".join(
        f'<div class="tile" style="left:{x + (shift if x > BASE_W / 2 else 0)}px;top:{y}px;'
        f'font-size:{s}px;transform:rotate({r}deg)">{e}</div>'
        for e, s, x, y, r in p["floats"]
    )
    return f"""<!doctype html><html><head><meta charset="utf-8">
<style>
{FONT}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:{W}px;height:{H}px;overflow:hidden;background:#000}}
.panel{{position:relative;width:{W}px;height:{H}px;overflow:hidden;
  background:linear-gradient(160deg,{c1} 0%,{c2} 100%);font-family:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif}}
.blob{{position:absolute;border-radius:50%;background:rgba(255,255,255,.09)}}
.b1{{width:760px;height:760px;left:-260px;top:300px}}
.b2{{width:620px;height:620px;right:-220px;top:-120px;background:rgba(255,255,255,.07)}}
.b3{{width:520px;height:520px;right:-160px;bottom:-140px}}
.dot{{position:absolute;width:44px;height:44px;border-radius:50%;background:{AMBER};right:{90 + shift // 2}px;top:118px;
  box-shadow:0 0 0 14px rgba(251,191,36,.18)}}
h1{{position:absolute;left:0;right:0;top:96px;text-align:center;color:#fff;
  font-weight:800;font-size:90px;line-height:1.08;letter-spacing:-2px;
  text-shadow:0 4px 18px rgba(0,0,0,.12)}}
.sub{{position:absolute;left:60px;right:60px;top:352px;text-align:center;color:rgba(255,255,255,.9);
  font-weight:600;font-size:42px;line-height:1.25;letter-spacing:-.3px}}
.phone{{position:absolute;left:{(W - phone_w) // 2}px;top:560px;
  width:{phone_w}px;height:{phone_h}px;border-radius:104px;background:#0e0e14;padding:20px;
  box-shadow:0 40px 90px rgba(10,8,60,.45),0 0 0 3px rgba(255,255,255,.08) inset;
  transform:rotate({p['tilt']}deg);transform-origin:50% 0%}}
.screen{{width:100%;height:100%;border-radius:86px;overflow:hidden;position:relative;background:#fff}}
.screen img{{width:100%;height:100%;display:block}}
.cam{{position:absolute;left:50%;top:34px;width:34px;height:34px;margin-left:-17px;border-radius:50%;background:#0b0b0f}}
.tile{{position:absolute;width:150px;height:150px;border-radius:38px;background:#fff;
  display:flex;align-items:center;justify-content:center;box-shadow:0 20px 44px rgba(20,14,90,.28)}}
</style></head><body>
<div class="panel">
  <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
  <h1>{p['title']}</h1>
  <div class="sub">{p['sub']}</div>
  <div class="phone"><div class="screen"><img src="{shot}"><div class="cam"></div></div></div>
  {floats}
</div></body></html>"""


def render(page: Path, out: Path, w: int, h: int, scale: float) -> None:
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         f"--force-device-scale-factor={scale}", f"--window-size={w},{h}",
         "--virtual-time-budget=6000", f"--screenshot={out}", page.as_uri()],
        check=True, capture_output=True,
    )


def feature_graphic(tmp: Path) -> None:
    icon = data_uri(ROOT.parent / "assets" / "icon.png")
    today = data_uri(SOURCE / "today.png")
    page = tmp / "feature.html"
    page.write_text(f"""<!doctype html><html><head><meta charset="utf-8"><style>
{FONT}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:1024px;height:500px;overflow:hidden}}
.f{{position:relative;width:1024px;height:500px;overflow:hidden;
 background:linear-gradient(120deg,{INDIGO_LT} 0%,{INDIGO} 55%,{INDIGO_DK} 100%);font-family:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif}}
.c{{position:absolute;border-radius:50%;background:rgba(255,255,255,.09)}}
.logo{{position:absolute;left:64px;top:92px;display:flex;align-items:center;gap:22px}}
.logo img{{width:96px;height:96px;border-radius:24px;box-shadow:0 14px 30px rgba(10,8,60,.35)}}
.logo span{{color:#fff;font-weight:800;font-size:64px;letter-spacing:-1.5px}}
h1{{position:absolute;left:66px;top:232px;color:#fff;font-weight:800;font-size:50px;line-height:1.12;letter-spacing:-1px}}
h1 em{{font-style:normal;color:#FDE68A}}
p{{position:absolute;left:68px;top:372px;width:520px;color:rgba(255,255,255,.88);font-weight:600;font-size:24px}}
.phone{{position:absolute;right:56px;top:52px;width:270px;height:606px;border-radius:40px;background:#0e0e14;padding:8px;
 transform:rotate(8deg);transform-origin:50% 0%;box-shadow:0 30px 60px rgba(10,8,60,.45)}}
.phone img{{width:100%;height:100%;border-radius:33px;display:block}}
</style></head><body><div class="f">
<div class="c" style="width:520px;height:520px;left:-160px;top:200px"></div>
<div class="c" style="width:420px;height:420px;right:-120px;top:-150px"></div>
<div class="logo"><img src="{icon}"><span>Mentto</span></div>
<h1>You teach,<br><em>Mentto keeps track</em></h1>
<p>For tutors, music teachers and coaches</p>
<div class="phone"><img src="{today}"></div></div></body></html>""", encoding="utf-8")
    out = ROOT / "feature-graphic-1024x500.png"
    render(page, out, 1024, 500, 1)
    print("wrote", out.name)


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        for folder, w, h, scale in TARGETS:
            target = OUT / folder
            target.mkdir(parents=True, exist_ok=True)
            for p in PANELS:
                if not (SOURCE / f"{p['src']}.png").exists():
                    print("skip (no source):", p["file"])
                    continue
                page = Path(tmp) / f"{folder}-{p['file']}.html"
                page.write_text(html_for(p, w, h), encoding="utf-8")
                render(page, target / f"{p['file']}.png", w, h, scale)
                print("wrote", f"{folder}/{p['file']}.png")
        feature_graphic(Path(tmp))


if __name__ == "__main__":
    main()
