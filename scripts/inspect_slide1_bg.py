import zipfile
from pathlib import Path

p = list(Path('presentation').glob('*.bak'))[0]
with zipfile.ZipFile(p, 'r') as zf:
    print("=== slide1.xml.rels ===")
    print(zf.read('ppt/slides/_rels/slide1.xml.rels').decode('utf-8'))
    print("=== slide1.xml bg ===")
    content = zf.read('ppt/slides/slide1.xml').decode('utf-8')
    import re
    m = re.search(r'<p:bg[\s\S]*?</p:bg>', content)
    if m:
        print(m.group(0))
