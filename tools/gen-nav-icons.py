#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NanoBanana Nav Icons Generator
Creates 8 unique elegant minimalist icons for the sidebar menu.
Style aligned exactly with the site's visual identity (soft editorial + brand palette).
Run: python tools/gen-nav-icons.py
"""
import os, json, base64, urllib.request, urllib.error, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'img', 'icons')
os.makedirs(OUT, exist_ok=True)

def read_key():
    k = os.environ.get("GEMINI_API_KEY")
    if k: return k
    env = r"C:\Users\GilNew\Desktop\מסמכים חדש\אפליקציות\דרור\.env.local"
    for line in open(env, encoding="utf-8"):
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"\'')
    raise RuntimeError("GEMINI_API_KEY not found – check sibling דרור/.env.local")

KEY = read_key()
MODEL = "gemini-2.5-flash-image"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}"

# Base visual language from the project's nougat-banana / gen.py
STYLE_BASE = (
    "Soft minimalist editorial icon illustration, calm and airy. "
    "Muted refined brand palette: olive/sage green (#4e9a45), teal sea-blue (#1f87b0), "
    "warm sand beige/terracotta (#dd7a3c), soft cream (#f5f8fa). "
    "Clean precise monoline mixed with delicate soft shading, generous elegant negative space, "
    "professional understated infrastructure + nature + future vision theme. "
    "Perfectly centered tight symbolic composition ideal for 36–40 px sidebar navigation icons, "
    "square-ish balanced format, clean on transparent or ultra-minimal soft cream background. "
    "NO text, no letters, no numbers, no logos."
)

# Exact 8 icon prompts – tightly themed to the 8 menu items and site story
PROMPTS = {
    "nav-future":       "Elegant symbolic icon: modern precise tunnel portal arch leading straight forward toward glowing soft dawn horizon, distant calm Jordan Valley hills and subtle light breakthrough. Conveys immediate optimistic future.",
    "nav-vision":       "Subtle elegant icon of clean modern eco urban grain: low buildings integrated gently with date palms and nature, open streets, harmonious city-nature balance vision.",
    "nav-growth":       "Clean sophisticated icon of layered mountain of currency coins merging smoothly into upward arrowed road + rail line stretching to horizon – representing layered PPP economic engine + global capital flow.",
    "nav-lab":          "Elegant integrated triple-symbol icon: crystal clear water drop over gentle sun disk above abstract microchip grid, all balanced harmoniously symbolizing advanced desalinization, solar energy and AI resource management lab.",
    "nav-world":        "Delicate editorial icon: softly curved elegant world arc highlighting the Levant as pivotal node, dotted trade line connecting east-west through marked Israel/Jordan valley, global connectivity in refined style.",
    "nav-exec":         "Sophisticated engineering icon: cross-cut elegant schematic of long infrastructural tunnels with rail lines and ventilation, TBM machine silhouette at work, precision and power.",
    "nav-bluegreen":    "Beautiful poetic icon of curved turquoise canal flowing into reflective calm desert lake framed with slender palm silhouettes and delicate green oasis, embodying the blue-green ecological water revolution.",
    "nav-cta":          "Open welcoming forward path icon: elegant straight pathway vanishing gently into infinite bright horizon, gate-like arch framing subtle rays – inviting optimistic call-to-action journey.",
}

def gen(prompt, out_path, tries=3):
    full_prompt = prompt + " " + STYLE_BASE
    body = {"contents": [{"role": "user", "parts": [{"text": full_prompt}]}]}
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(
                URL,
                data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json"}
            )
            j = json.load(urllib.request.urlopen(req, timeout=180))
            for p in j.get("candidates", [{}])[0].get("content", {}).get("parts", []):
                inl = p.get("inlineData") or p.get("inline_data")
                if inl and inl.get("data"):
                    os.makedirs(os.path.dirname(out_path), exist_ok=True)
                    open(out_path, "wb").write(base64.b64decode(inl["data"]))
                    return True
            last = "no inline image"
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code} {e.read().decode()[:300]}"
            if e.code in (429, 500, 503):
                time.sleep(3 * (a + 1)); continue
            break
        except Exception as e:
            last = str(e)[:300]
            time.sleep(2)
    print("FAIL", out_path, "|", last, file=sys.stderr)
    return False

if __name__ == "__main__":
    import sys
    print("=== NanoBanana Nav Icons Generation (פריצת דרך) ===")
    ok = fail = 0
    for name, desc in PROMPTS.items():
        out = os.path.join(OUT, f"{name}.png")
        if os.path.exists(out) and os.path.getsize(out) > 3000:
            print(f"skip {name} (exists)")
            ok += 1
            continue
        print(">> generating", name, flush=True)
        good = gen(desc, out)
        stat = "OK" if good else "FAIL"
        print("   " + stat, name)
        ok += good; fail += (not good)
        time.sleep(1.2)
    print(f"\nDONE  ok={ok} fail={fail}")
    print(f"Icons saved to: {OUT}") 
