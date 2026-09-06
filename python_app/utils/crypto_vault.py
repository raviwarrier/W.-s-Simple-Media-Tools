import os
import json
import base64
from typing import Dict, Any, Optional
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.fernet import Fernet

VAULT_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".secrets_vault.enc")
SALT_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".secrets_salt.bin")

def _get_or_create_salt() -> bytes:
    if os.path.exists(SALT_FILE):
        with open(SALT_FILE, "rb") as f:
            return f.read()
    salt = os.urandom(16)
    with open(SALT_FILE, "wb") as f:
        f.write(salt)
    return salt

def _derive_key(passphrase: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    return base64.urlsafe_b64encode(kdf.derive(passphrase.encode("utf-8")))

class EncryptedVault:
    def __init__(self, master_password: str = "default_vault_secret_2026"):
        self.salt = _get_or_create_salt()
        self.key = _derive_key(master_password, self.salt)
        self.fernet = Fernet(self.key)
        self.data: Dict[str, Any] = {
            "key_mode": "unified", # "unified" or "per_module"
            "unified_openai_key": "",
            "module_openai_keys": {
                "video_transcriber": "",
                "audiobook_transcriber": "",
                "audio_extractor": "",
            },
            "custom_tokens": {}
        }
        self.load()

    def load(self) -> None:
        if os.path.exists(VAULT_FILE):
            try:
                with open(VAULT_FILE, "rb") as f:
                    encrypted_bytes = f.read()
                decrypted = self.fernet.decrypt(encrypted_bytes).decode("utf-8")
                self.data = json.loads(decrypted)
            except Exception:
                pass

    def save(self) -> None:
        try:
            payload = json.dumps(self.data).encode("utf-8")
            encrypted_bytes = self.fernet.encrypt(payload)
            with open(VAULT_FILE, "wb") as f:
                f.write(encrypted_bytes)
        except Exception as e:
            print(f"Error saving secrets vault: {e}")

    def get_openai_key(self, module_name: Optional[str] = None) -> str:
        # Check environment variable first as fallback
        env_key = os.getenv("OPENAI_API_KEY", "")
        if self.data.get("key_mode") == "unified":
            return self.data.get("unified_openai_key") or env_key
        else:
            if module_name and module_name in self.data.get("module_openai_keys", {}):
                specific_key = self.data["module_openai_keys"][module_name]
                if specific_key:
                    return specific_key
            return self.data.get("unified_openai_key") or env_key

    def set_key_mode(self, mode: str):
        self.data["key_mode"] = mode
        self.save()

    def set_unified_key(self, key: str):
        self.data["unified_openai_key"] = key
        self.save()

    def set_module_key(self, module_name: str, key: str):
        if "module_openai_keys" not in self.data:
            self.data["module_openai_keys"] = {}
        self.data["module_openai_keys"][module_name] = key
        self.save()
