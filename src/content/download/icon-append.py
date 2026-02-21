
#!/usr/bin/env python3
import os
import sys
import shutil
from pathlib import Path

# Configuration
SOURCE_THEME = Path("/usr/share/icons/breeze-dark")
DEST_ROOT = Path("KRunner-Icons-Override")
SCHEME_FILE = Path("breeze-debug-crisp/icon_scheme.txt")

def get_size_priority(path_obj):
    """
    Helper to extract size from path for sorting.
    Prioritizes 'scalable' > largest integer > others.
    """
    parts = path_obj.parts
    for part in reversed(parts):
        if part.isdigit():
            return int(part)
        if part == 'scalable':
            return 9999
    return 0

def main():
    # 1. Parse Arguments
    requested_keys = set(sys.argv[1:])
    
    if not requested_keys:
        print("Usage: ./append <key1> [key2 ...]")
        print("Example: ./append 4ms6 4ms7")
        sys.exit(1)

    if not SCHEME_FILE.exists():
        print(f"Error: Could not find input file: {SCHEME_FILE}")
        sys.exit(1)

    # 2. Read the scheme file
    with open(SCHEME_FILE, 'r') as f:
        lines = f.readlines()

    processed_keys = set()
    
    print(f"Searching for {len(requested_keys)} icons in {SCHEME_FILE}...")

    for line in lines:
        line = line.strip()
        if not line or " = " not in line:
            continue

        # Parse line: 4msh = status/256/waveform-off-symbolic.svg
        code, target_rel_path = line.split(" = ", 1)

        # Only process if this code was requested
        if code not in requested_keys:
            continue
        
        # Mark as found
        processed_keys.add(code)
        
        filename = Path(target_rel_path).name
        
        # 3. Search for the source icon
        candidates = list(SOURCE_THEME.rglob(filename))

        if not candidates:
            print(f"[{code}] Warning: Source file '{filename}' not found in {SOURCE_THEME}")
            continue

        # 4. Select best resolution
        best_candidate = sorted(candidates, key=get_size_priority, reverse=True)[0]

        # 5. Resolve Symlinks
        try:
            real_source = best_candidate.resolve(strict=True)
        except FileNotFoundError:
            print(f"[{code}] Error: Symlink broken for {best_candidate}")
            continue

        # 6. Prepare Destination
        dest_path = DEST_ROOT / target_rel_path
        
        # Create parent directories
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        # 7. Copy
        try:
            shutil.copy2(real_source, dest_path)
            print(f"[{code}] OK: {real_source.name} ({best_candidate.parent.name}) -> {dest_path}")
        except Exception as e:
            print(f"[{code}] Failed to copy: {e}")

    # 8. Report missing inputs
    missing = requested_keys - processed_keys
    if missing:
        print(f"\nWarning: The following keys were not found in {SCHEME_FILE.name}:")
        print(f"  {', '.join(missing)}")

if __name__ == "__main__":
    main()