"""Validate all USWDS grant example artifacts."""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

result = subprocess.run(
    [
        sys.executable, "-m", "formspec.validate",
        str(HERE),
    ],
    cwd=ROOT,
    env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")},
)
sys.exit(result.returncode)
