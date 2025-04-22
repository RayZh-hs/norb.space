import sys
import os
from PIL import Image

# --- Configuration ---
# Filename: (size) for square PNGs
TARGETS = [
    ("android-chrome-512x512.png", 512),
    ("android-chrome-192x192.png", 192),
    ("apple-touch-icon.png", 192),
    ("favicon-32x32.png", 32),
    ("favicon-16x16.png", 16),
]
# ICO specific settings
ICO_FILENAME = "favicon.ico"
ICO_SIZES = [(16, 16), (32, 32)] # Sizes to include *within* the .ico file
# ---------------------

def create_favicons(source_image_path):
    """Generates favicons and icons from a source image."""
    if not os.path.isfile(source_image_path):
        print(f"Error: Source image '{source_image_path}' not found.")
        sys.exit(1)

    try:
        with Image.open(source_image_path) as img:
            img = img.convert("RGBA") # Ensure transparency support
            print(f"Opened '{source_image_path}' successfully.")

            # Create PNG files
            for filename, size in TARGETS:
                print(f"- Generating {filename} ({size}x{size})...")
                resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
                resized_img.save(filename)

            # Create ICO file (Pillow handles internal resizing)
            print(f"- Generating {ICO_FILENAME} (sizes: {ICO_SIZES})...")
            img.save(ICO_FILENAME, format='ICO', sizes=ICO_SIZES)

            print("\nAll files generated successfully!")

    except Exception as e:
        print(f"\nAn error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {os.path.basename(__file__)} <source_logo_image>")
        print("Example: python generate_favicons.py my_logo.png")
        sys.exit(1)

    source_logo = sys.argv[1]
    create_favicons(source_logo)