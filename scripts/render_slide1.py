import fitz  # PyMuPDF
import sys

doc = fitz.open('presentation/Москоллектор_НейроКонтур_Защита.pdf')
print(f"Total pages in PDF: {len(doc)}")
page = doc[0]
pix = page.get_pixmap(dpi=150)
pix.save('presentation/slide_1_rendered.png')
print("Saved presentation/slide_1_rendered.png")
text = page.get_text()
print("=== Page 1 Text from PDF ===")
print(text)
