import zipfile
from pathlib import Path

p = list(Path('presentation').glob('*.bak'))[0]
with zipfile.ZipFile(p, 'r') as zf:
    for name in zf.namelist():
        if name.startswith('ppt/media/'):
            info = zf.getinfo(name)
            print(f"{name}: {info.file_size} bytes")
