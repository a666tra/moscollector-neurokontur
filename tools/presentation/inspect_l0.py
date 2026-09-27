import sys
from pathlib import Path
from pptx import Presentation

sys.stdout.reconfigure(encoding='utf-8')
p = list(Path('presentation').glob('*.bak'))[0]
prs = Presentation(str(p))
l0 = prs.slide_layouts[0]
print("Layout 0 XML:")
print(l0._element.xml[:2000])
