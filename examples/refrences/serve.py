#!/usr/bin/env python3
"""FastAPI dev server for the references example app, serving static assets."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))

from fastapi.staticfiles import StaticFiles
import importlib.util

spec = importlib.util.spec_from_file_location("main", ROOT / "examples/refrences/server/main.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
app = mod.app

app.mount("/examples", StaticFiles(directory=str(ROOT / "examples")), name="examples")
app.mount("/registries", StaticFiles(directory=str(ROOT / "registries")), name="registries")
app.mount("/", StaticFiles(directory=str(ROOT / "examples/refrences/dist"), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
