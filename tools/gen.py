#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""מייצר את כל רקעי האתר בנאנו בננה, בסגנון אחיד בפלטת המותג."""
import os, sys, importlib.util, time

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("nb", os.path.join(HERE, "nb.py"))
nb = importlib.util.module_from_spec(spec); spec.loader.exec_module(nb)
OUT = os.path.join(os.path.dirname(HERE), "assets", "img", "scenes")

STYLE = (" Soft minimalist editorial illustration, calm and airy. Muted brand palette: "
         "olive/sage green, teal sea-blue, warm sand beige, on a light cream background. "
         "Flat with gentle subtle shading, lots of negative space, professional and understated, "
         "wide cinematic composition. NO text, no words, no letters, no logos, no people.")

SCENES = {
  "valley":  "The Jordan Valley landscape: clusters of date palm trees, rows of cultivated fields, distant low desert hills, warm calm sky.",
  "tunnel":  "A modern infrastructure tunnel portal opening from a green coastal plain toward a bright desert valley, a sleek train just emerging from the arch.",
  "sea":     "The Mediterranean coastline with a cargo port and a container ship, a faint dotted trade route arcing toward the horizon, calm water.",
  "water":   "Water bringing life to the desert valley: a calm canal and a serene lake, palm trees and greenery along the banks, soft reflections.",
  "solar":   "A vast solar energy field of photovoltaic panels in a sunny desert valley, the sun low and warm, distant hills.",
  "city":    "A modern sustainable green city in a desert valley: low eco buildings among trees and date palms, wide calm streets.",
  "network": "An abstract smart-city concept: a calm valley town overlaid with subtle glowing connected network nodes and soft data lines.",
  "globe":   "An abstract intercontinental trade corridor concept: a soft world-map arc connecting Asia, the Gulf and Europe through the Levant, a dotted route line.",
  "climate": "A gentle green microclimate softening an arid desert valley: lush vegetation, water and trees, distant hills, fresh and calm.",
  "hero":    "A wide panoramic Jordan Valley at dawn: date palm trees in the foreground, a subtle tunnel portal connecting the coastal plain to the eastern valley, distant low desert hills, soft cream and olive light.",
}

def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    ok = fail = 0
    for name, base in SCENES.items():
        if only and only not in name:
            continue
        out = os.path.join(OUT, name + ".png")
        if os.path.exists(out) and os.path.getsize(out) > 5000:
            print("skip", name, flush=True); ok += 1; continue
        good = nb.gen(base + STYLE, out)
        print(("OK  " if good else "FAIL"), name, flush=True)
        ok += good; fail += (not good)
        time.sleep(1)
    print("DONE ok=%d fail=%d" % (ok, fail), flush=True)

main()
