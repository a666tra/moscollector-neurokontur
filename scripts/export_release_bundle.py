import os
import sys
import zipfile
import hashlib
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

EXCLUDE_DIRS = {
    'tools',
    '.git',
    '.pytest_cache',
    '__pycache__',
    'node_modules',
    'dist_release',
    'release',
    'slides_png',
    'tz_pages',
}

EXCLUDE_DIR_PREFIXES = (
    'ChatExport',
)

EXCLUDE_EXTS = {
    '.pyc',
    '.pyo',
    '.bak',
    '.tmp',
    '.7z',
    '.zip',
    '.gz',
    '.tar',
    '.rar',
}

EXCLUDE_GLOBAL_FILES = {
    # CRITICAL: Organizer chat dumps containing credentials
    'chat_parsed.txt',
    'chat_relevant_qa.txt',
    # Security: Local credentials
    'authorized_dispatchers.json',
}

EXCLUDE_ROOT_FILES = {
    # Raw organizer prompt and OCR dumps
    'tz_extracted.txt',
    'tz_ocr_text.txt',
    'ocr_tz.ps1',
    'Инструкция для участника.txt',
    'Ответы на вопросы.pdf.txt',
    'Ответы на вопросы.txt',
    # Scratch presentation dumps & old template
    'presentation_dump.txt',
    'presentation_dump_utf8.txt',
    'Шаблон2026 Презентация проекта.pptx',
    # Root duplicates of explanatory note (canonical are in docs/)
    'Пояснительная_записка_Москоллектор_НейроКонтур.docx',
    'Пояснительная_записка_Москоллектор_НейроКонтур.pdf',
}

EXCLUDE_SCRIPTS_PREFIXES = (
    'inspect_',
    'render_',
    'check_',
)

EXCLUDE_SCRIPTS_EXACT = {
    'extract_bg.py',
    'find_img_refs.py',
    'test_s1_bg.py',
    'dump_presentation.py',
}

def get_file_hash(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def is_excluded(path: Path) -> bool:
    rel_path = path.relative_to(ROOT_DIR)
    parts = rel_path.parts

    # Directory exclusions
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
        for prefix in EXCLUDE_DIR_PREFIXES:
            if part.startswith(prefix):
                return True
        if part.startswith('.') and part not in {'.dockerignore', '.gitignore'}:
            return True

    # Exclude heavy raw dataset subdirectories (extracted CSV and 7z archives)
    if len(parts) > 1 and parts[0] == 'dataset':
        if parts[1] in {'extracted', 'dataset'}:
            return True

    # Global security exclusions
    if path.name in EXCLUDE_GLOBAL_FILES:
        return True

    # Root-level only file exclusions
    if len(parts) == 1 and parts[0] in EXCLUDE_ROOT_FILES:
        return True

    # Scratch scripts exclusion
    if len(parts) > 1 and parts[0] == 'scripts':
        if path.name.startswith(EXCLUDE_SCRIPTS_PREFIXES):
            return True
        if path.name in EXCLUDE_SCRIPTS_EXACT:
            return True

    # Extension exclusion
    if path.suffix.lower() in EXCLUDE_EXTS:
        return True

    return False

def build_bundle():
    print(f"Project root: {ROOT_DIR}")
    release_dir = ROOT_DIR / "release"
    release_dir.mkdir(exist_ok=True)
    zip_path = release_dir / "Moscollector_NeuroKontur_Solution_Bundle.zip"
    manifest_path = zip_path.with_name(zip_path.name + ".sha256")

    # Pre-flight sanity checks of critical files
    critical_files = [
        ROOT_DIR / "README.md",
        ROOT_DIR / "PROJECT_PASSPORT.md",
        ROOT_DIR / "docs" / "SUBMISSION_CHECKLIST.md",
        ROOT_DIR / "PITCH_SCRIPT.md",
        ROOT_DIR / "docs" / "DATA_REQUEST_AND_PILOT_METHODOLOGY.md",
        ROOT_DIR / "docs" / "DATA_PROVENANCE_AND_REPRODUCIBILITY.md",
        ROOT_DIR / "docs" / "Пояснительная_записка_Москоллектор_НейроКонтур.pdf",
        ROOT_DIR / "docs" / "Пояснительная_записка_Москоллектор_НейроКонтур.docx",
        ROOT_DIR / "presentation" / "Москоллектор_НейроКонтур_Защита.pptx",
        ROOT_DIR / "presentation" / "Москоллектор_НейроКонтур_Защита.pdf",
        ROOT_DIR / "Презентация" / "Москоллектор_НейроКонтур_Презентация.pptx",
        ROOT_DIR / "dataset" / "sample_synthetic_telemetry.csv",
        ROOT_DIR / "dataset" / "README.md",
        ROOT_DIR / "backend" / "models" / "champion_calibrator.joblib",
        ROOT_DIR / "backend" / "models" / "champion_calibrator_beta.joblib",
        ROOT_DIR / "scripts" / "refresh_prediction_cache_calibration.py",
        ROOT_DIR / "backend" / "app" / "api" / "synthetic.py",
        ROOT_DIR / "scripts" / "reproduce_metrics.py",
        ROOT_DIR / "tests" / "test_api.py",
        ROOT_DIR / "tests" / "test_synthetic_pipeline.py",
        ROOT_DIR / "frontend" / "dist" / "index.html",
    ]
    for cf in critical_files:
        if not cf.exists():
            print(f"ERROR: Critical file missing: {cf}")
            sys.exit(1)

    print("Pre-flight checks passed.")
    print(f"Creating release archive: {zip_path.name}")

    # Invalidate any previous checksum before replacing the archive. A failed
    # build must not leave a sidecar that appears to describe the new ZIP.
    if manifest_path.exists():
        manifest_path.unlink()

    count = 0
    total_uncompressed = 0

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(ROOT_DIR):
            root_path = Path(root)
            # Prune excluded directories in-place
            dirs[:] = [d for d in dirs if not is_excluded(root_path / d)]

            for file in sorted(files):
                file_path = root_path / file
                if is_excluded(file_path):
                    continue

                rel_path = file_path.relative_to(ROOT_DIR)
                arcname = str(rel_path).replace('\\', '/')
                zf.write(file_path, arcname=arcname)
                count += 1
                total_uncompressed += file_path.stat().st_size

    zip_size = zip_path.stat().st_size
    zip_hash = get_file_hash(zip_path)

    # Post-build verification
    print("\nRunning post-build security, content-scan and integrity checks...")
    with zipfile.ZipFile(zip_path, 'r') as zf:
        namelist = set(zf.namelist())

        # 1. Zero credential leaks verification (names)
        forbidden_entries = [
            'chat_parsed.txt',
            'chat_relevant_qa.txt',
            'authorized_dispatchers.json',
            'tz_extracted.txt',
            'tz_ocr_text.txt',
            'dataset/extracted/ext-journal-2026.csv',
        ]
        for fe in forbidden_entries:
            if fe in namelist:
                print(f"FATAL SECURITY VIOLATION: {fe} is present in release ZIP!")
                sys.exit(1)

        for name in namelist:
            if 'ChatExport' in name:
                print(f"FATAL SECURITY VIOLATION: Chat export file {name} in release ZIP!")
                sys.exit(1)
            if name.endswith('.7z'):
                print(f"FATAL: Heavy archive {name} in release ZIP!")
                sys.exit(1)

        # 2. Deep content-level scanning of all packaged text files
        text_extensions = ('.py', '.md', '.json', '.ts', '.tsx', '.html', '.css', '.yml', '.yaml', '.txt', '.csv', '.sh', '.ps1')
        scanned_count = 0
        # Suspicious patterns to verify absence
        forbidden_content_substrings = [
            'raw_' + 'password',
            'BEGIN ' + 'RSA PRIVATE KEY',
            'BEGIN ' + 'OPENSSH PRIVATE KEY',
            'BEGIN ' + 'PRIVATE KEY',
        ]
        for name in namelist:
            if any(name.endswith(ext) for ext in text_extensions):
                content_bytes = zf.read(name)
                try:
                    text_content = content_bytes.decode('utf-8', errors='replace')
                    scanned_count += 1
                    for forbidden in forbidden_content_substrings:
                        if forbidden in text_content:
                            print(f"FATAL SECURITY VIOLATION: Forbidden token '{forbidden}' in {name}!")
                            sys.exit(1)
                except Exception as e:
                    pass

        print(f"Deep content security scan: {scanned_count} text files scanned, 0 sensitive tokens detected.")

        # 3. Key deliverable presence verification
        required_in_zip = [
            'README.md',
            'PROJECT_PASSPORT.md',
            'docs/SUBMISSION_CHECKLIST.md',
            'PITCH_SCRIPT.md',
            'docs/DATA_REQUEST_AND_PILOT_METHODOLOGY.md',
            'docs/DATA_PROVENANCE_AND_REPRODUCIBILITY.md',
            'docs/Пояснительная_записка_Москоллектор_НейроКонтур.pdf',
            'docs/Пояснительная_записка_Москоллектор_НейроКонтур.docx',
            'presentation/Москоллектор_НейроКонтур_Защита.pptx',
            'presentation/Москоллектор_НейроКонтур_Защита.pdf',
            'Презентация/Москоллектор_НейроКонтур_Презентация.pptx',
            'dataset/sample_synthetic_telemetry.csv',
            'dataset/README.md',
            'backend/models/champion_calibrator.joblib',
            'backend/models/champion_calibrator_beta.joblib',
            'backend/app/main.py',
            'backend/app/api/synthetic.py',
            'scripts/reproduce_metrics.py',
            'tests/test_api.py',
            'tests/test_ml_calibration.py',
            'tests/test_synthetic_pipeline.py',
            'frontend/dist/index.html',
        ]
        for req in required_in_zip:
            if req not in namelist:
                print(f"FATAL INTEGRITY VIOLATION: Required deliverable {req} missing from release ZIP!")
                sys.exit(1)

    # The checksum sidecar is written only after all archive checks pass. The
    # release directory is excluded from packaging, so this manifest cannot
    # recursively contribute to the ZIP hash it records.
    manifest_path.write_text(f"{zip_hash}  {zip_path.name}\n", encoding="ascii")

    print("Post-build security and integrity verification: PASSED (0 leaks, all deliverables present).")

    print("\n" + "="*60)
    print("RELEASE BUNDLE GENERATED SUCCESSFULLY")
    print("="*60)
    print(f"Archive file:        {zip_path}")
    print(f"Packaged files:      {count}")
    print(f"Uncompressed size:   {total_uncompressed / (1024*1024):.2f} MB")
    print(f"Archive size:        {zip_size / (1024*1024):.2f} MB")
    print(f"SHA-256:             {zip_hash}")
    print(f"SHA-256 manifest:    {manifest_path}")
    print("="*60)

    print("\nCritical Artifact Hashes:")
    for cf in critical_files:
        rel = cf.relative_to(ROOT_DIR)
        rel_str = str(rel).replace('\\', '/')
        h = get_file_hash(cf)
        print(f"  {h}  {rel_str}")

if __name__ == '__main__':
    build_bundle()
