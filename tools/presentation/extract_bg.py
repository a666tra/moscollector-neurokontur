import zipfile
from pathlib import Path

p = list(Path('presentation').glob('*.bak'))[0]
with zipfile.ZipFile(p, 'r') as zf:
    for img_name in ['image1.png', 'image2.png', 'image3.png', 'image7.png']:
        data = zf.read(f'ppt/media/{img_name}')
        with open(f'presentation/{img_name}', 'wb') as f:
            f.write(data)
        print(f"Extracted presentation/{img_name} ({len(data)} bytes)")
