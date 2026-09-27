import zipfile
import re
from pathlib import Path

p = list(Path('presentation').glob('*.bak'))[0]
with zipfile.ZipFile(p, 'r') as zf:
    for name in zf.namelist():
        if name.endswith('.rels') or name.endswith('.xml'):
            content = zf.read(name).decode('utf-8', errors='ignore')
            if 'image3.png' in content:
                print(f"Found image3.png in: {name}")
            if 'image2.png' in content:
                print(f"Found image2.png in: {name}")
