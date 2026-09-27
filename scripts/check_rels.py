import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

p = list(Path('presentation').glob('*.bak'))[0]
with zipfile.ZipFile(p, 'r') as zf:
    for name in zf.namelist():
        if 'slideLayout1.xml.rels' in name or 'slideMaster1.xml.rels' in name:
            print(f"=== {name} ===")
            tree = ET.fromstring(zf.read(name))
            for rel in tree:
                print(rel.attrib)
