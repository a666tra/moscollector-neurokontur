import sys
import pymupdf
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = 'presentation/Москоллектор_НейроКонтур_Защита.pdf'
doc = pymupdf.open(pdf_path)
print(f"Total pages: {len(doc)}")

out_dir = Path('presentation/audit_renders')
out_dir.mkdir(exist_ok=True)

# Render all 18 pages
for pno in range(len(doc)):
    page = doc[pno]
    pix = page.get_pixmap(dpi=150)
    out_file = out_dir / f"page_{pno+1:02d}.png"
    pix.save(str(out_file))
    # Extract text to verify contents
    txt = page.get_text()
    first_line = txt.strip().split('\n')[0] if txt.strip() else "NO TEXT"
    print(f"Page {pno+1:02d}: {first_line[:60]} ({len(txt)} chars)")
