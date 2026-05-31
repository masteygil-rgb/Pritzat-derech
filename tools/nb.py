#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""נאנו בננה — יצירת תמונות עם מפתח GEMINI_API_KEY (כמו ב'דרור')."""
import json, sys, base64, os, urllib.request, urllib.error

# קריאת המפתח מ-.env.local של 'דרור' (מקור האמת היחיד — לא משוכפל לכאן)
def read_key():
    k = os.environ.get("GEMINI_API_KEY")
    if k: return k
    env = r"c:\Users\GilNew\Desktop\מסמכים חדש\אפליקציות\דרור\.env.local"
    for line in open(env, encoding="utf-8"):
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"\'')
    raise RuntimeError("GEMINI_API_KEY not found")

KEY = read_key()
MODEL = "gemini-2.5-flash-image"
URL = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s" % (MODEL, KEY)

def gen(prompt, out, tries=3):
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(URL, data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json"})
            j = json.load(urllib.request.urlopen(req, timeout=120))
            for p in j.get("candidates", [{}])[0].get("content", {}).get("parts", []):
                inl = p.get("inlineData") or p.get("inline_data")
                if inl and inl.get("data"):
                    os.makedirs(os.path.dirname(out), exist_ok=True)
                    open(out, "wb").write(base64.b64decode(inl["data"]))
                    return True
            last = "no image: " + json.dumps(j)[:200]
        except urllib.error.HTTPError as e:
            last = "HTTP %s %s" % (e.code, e.read().decode()[:200])
            if e.code in (429, 500, 503): import time; time.sleep(3*(a+1)); continue
            break
        except Exception as e:
            last = str(e)[:200]; import time; time.sleep(2)
    print("FAIL", out, "|", last, file=sys.stderr)
    return False

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("-p", required=True); ap.add_argument("-o", required=True)
    a = ap.parse_args()
    print("OK " + a.o if gen(a.p, a.o) else "FAILED")
