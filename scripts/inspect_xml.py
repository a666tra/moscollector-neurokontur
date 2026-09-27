import sys
from pathlib import Path
from pptx import Presentation

sys.stdout.reconfigure(encoding='utf-8')
p = list(Path('presentation').glob('*.bak'))[0]
prs = Presentation(str(p))
s1 = prs.slides[0]

print("Slide 1 layout xml:")
print(s1.slide_layout._element.xml[:1500])
print("...")
print("Slide 1 master xml:")
print(s1.slide_layout.slide_master._element.xml[:1500])
