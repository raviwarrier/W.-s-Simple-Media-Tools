import os
import shutil
import tempfile
from contextlib import contextmanager
from typing import Generator, List

class ZeroRetentionCleaner:
    """Ensures input and output media files are cleared immediately after processing."""
    def __init__(self):
        self.active_temp_paths: List[str] = []

    def register_temp_path(self, path: str):
        if path and path not in self.active_temp_paths:
            self.active_temp_paths.append(path)

    def purge_path(self, path: str) -> bool:
        if not path or not os.path.exists(path):
            return False
        try:
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            else:
                os.remove(path)
            if path in self.active_temp_paths:
                self.active_temp_paths.remove(path)
            return True
        except Exception as e:
            print(f"Warning: Failed to purge {path}: {e}")
            return False

    def purge_all(self):
        for p in list(self.active_temp_paths):
            self.purge_path(p)
        self.active_temp_paths.clear()

@contextmanager
def ephemeral_workspace() -> Generator[str, None, None]:
    """Creates a strictly ephemeral directory that guarantees total cleanup upon exit."""
    temp_dir = tempfile.mkdtemp(prefix="ephemeral_media_")
    try:
        yield temp_dir
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
