"""Publish the prototype as a Hugging Face Docker Space.

Usage (PowerShell):
    $env:HF_TOKEN = "hf_..."            # write token, never commit it
    python scripts/deploy_hf_space.py --space <hf-user>/moscollector-neurokontur --demo-pin 135790

The Space builds the repository Dockerfile. Only files needed by the image are uploaded;
the Space README (with the required YAML header) comes from deploy/hf_space/README.md.
"""
import argparse
import os
import re
import sys

from huggingface_hub import HfApi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ALLOW = ['Dockerfile', '.dockerignore', 'requirements.txt', 'backend/**', 'frontend/**']
IGNORE = ['frontend/node_modules/**', 'frontend/dist/**', '**/__pycache__/**', '**/*.pyc',
          'backend/data/authorized_dispatchers.json', 'backend/data/rolling_backtest_features.npz',
          'backend/data/extracted_features_cache.npz']


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--space', required=True, help='<user>/<space-name>')
    ap.add_argument('--demo-pin', help='six-digit PIN for the public demo dispatcher (stored as a Space variable)')
    ap.add_argument('--private', action='store_true')
    args = ap.parse_args()
    token = os.environ.get('HF_TOKEN')
    if not token:
        sys.exit('Set HF_TOKEN in the environment (write access).')
    api = HfApi(token=token)
    api.create_repo(args.space, repo_type='space', space_sdk='docker', private=args.private, exist_ok=True)
    if args.demo_pin:
        if not re.fullmatch(r'\d{6}', args.demo_pin):
            sys.exit('--demo-pin must be six digits')
        api.add_space_variable(args.space, 'LCT_DEMO_DISPATCHER_PIN', args.demo_pin)
    api.upload_folder(repo_id=args.space, repo_type='space', folder_path=ROOT,
                      allow_patterns=ALLOW, ignore_patterns=IGNORE,
                      commit_message='Deploy prototype')
    api.upload_file(repo_id=args.space, repo_type='space',
                    path_or_fileobj=os.path.join(ROOT, 'deploy', 'hf_space', 'README.md'),
                    path_in_repo='README.md', commit_message='Space card')
    user, name = args.space.split('/')
    print(f'Space: https://huggingface.co/spaces/{args.space}')
    print(f'App:   https://{user.lower()}-{name.lower().replace("_", "-")}.hf.space  (build takes 3-6 min)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
