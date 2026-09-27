import sys
from pathlib import Path
from pptx import Presentation

sys.stdout.reconfigure(encoding='utf-8')
p = list(Path('presentation').glob('*.bak'))[0]
prs = Presentation(str(p))

for i, l in enumerate(prs.slide_layouts):
    print(f"Layout {i}: name='{l.name}', shapes={len(l.shapes)}")

# Check slide 1 background
s1 = prs.slides[0]
print("s1 layout:", s1.slide_layout.name)
