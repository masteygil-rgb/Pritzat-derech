#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""מעבד את תמונות הבקעה לקבצי web מותאמים (רוחב אחיד, JPEG איכותי, קל)."""
import os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, "assets", "img", "photos")
OUT  = os.path.join(ROOT, "assets", "img", "site")
os.makedirs(OUT, exist_ok=True)

# מיפוי: קובץ מקור -> (שם יעד, רוחב מטרה)
# wide=1600 לבאנרים רחבים, std=1200 לתמונות תוכן
MAP = {
    # ── נופי בקעה ──
    "121117_yarden-600x400.jpg":            ("valley-dawn", 1200),
    "bika-nof-from-cafe-rotem_il.jpg":      ("valley-wide", 1600),
    "images.jpg":                            ("valley-green", 1200),
    "images (1).jpg":                        ("valley-cliffs", 1000),
    "778717696.webp":                        ("valley-hills", 1000),
    "Heritage-Conservation-Outside-The-City-Pikiwiki-Israel-27.1-ארץ-המעברים-סיור.jpg": ("valley-road", 1400),
    "פנורמה.jpg":                       ("valley-aerial", 1000),
    # ── חקלאות ──
    "ChatGPT Image May 31, 2026, 03_24_16 AM.png": ("agri-palms", 1200),
    "חוות-.jpg":                          ("agri-farm", 1400),
    "קבלו-תאילנד-3.webp":           ("agri-plantation", 1600),
    "תיירות-בקעת-הירדן-300x200.jpg": ("agri-grove", 1000),
    # ── תשתית ──
    "ChatGPT Image May 31, 2026, 03_29_09 AM.png": ("infra-highway", 1600),
    "CAL0291555_o.jpg":                      ("infra-tbm", 1400),
    "2b0a8c1f51934af8fb2827b0c811641a.webp": ("infra-tunnel-build", 1600),
    "H1m2oRl1JMx_0_0_1401_845_0_x-large.avif": ("infra-tunnel-rail", 1400),
}

def process():
    done = []
    for src, (name, w) in MAP.items():
        p = os.path.join(SRC, src)
        if not os.path.exists(p):
            print("MISSING", src); continue
        try:
            im = Image.open(p)
            im = ImageOps.exif_transpose(im).convert("RGB")
            if im.width > w:
                h = round(im.height * w / im.width)
                im = im.resize((w, h), Image.LANCZOS)
            out = os.path.join(OUT, name + ".jpg")
            im.save(out, "JPEG", quality=82, optimize=True, progressive=True)
            kb = os.path.getsize(out) // 1024
            done.append("%s -> %s.jpg (%dx%d, %dKB)" % (src, name, im.width, im.height, kb))
        except Exception as e:
            print("ERR", src, e)
    for d in done: print("OK", d)
    print("TOTAL", len(done))

process()
