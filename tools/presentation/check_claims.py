import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

terms = ['nginx', 'непрерывн', 'транзакционн', 'работающая интеграц', 'работающей интеграц']

for root, dirs, files in os.walk('.'):
    if any(x in root for x in ['.git', 'node_modules', 'ChatExport', 'tz_pages']):
        continue
    for f in files:
        if f.endswith(('.py', '.md', '.json', '.ts', '.tsx', '.html', '.txt')):
            p = os.path.join(root, f)
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                    for lnum, line in enumerate(fp, 1):
                        for t in terms:
                            if t.lower() in line.lower():
                                print(f"{p}:{lnum} [{t}]: {line.strip()[:100]}")
            except:
                pass
