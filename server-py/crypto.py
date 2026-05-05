"""
crypto.py — AES-GCM decrypt matching the React Native client's crypto.js.
The client encrypts using crypto-js with the shared ENCRYPTION_KEY.
"""
import os
import json
import hashlib
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv

load_dotenv()

_RAW_KEY = os.getenv("ENCRYPTION_KEY", "palfin-super-secret-key")

# Derive a 32-byte key from the string (SHA-256), matching crypto-js behaviour
ENCRYPTION_KEY = hashlib.sha256(_RAW_KEY.encode()).digest()


def decrypt_payload(payload: dict) -> dict:
    """
    Decrypts a payload of the form:
      { "encryptedData": "hex...", "iv": "hex...", "authTag": "hex..." }

    Returns the decrypted dict, or raises ValueError on failure.
    """
    try:
        encrypted = bytes.fromhex(payload["encryptedData"])
        iv = bytes.fromhex(payload["iv"])
        auth_tag = bytes.fromhex(payload["authTag"])

        # AES-GCM: ciphertext is encrypted || authTag in cryptography lib
        aesgcm = AESGCM(ENCRYPTION_KEY)
        plaintext = aesgcm.decrypt(iv, encrypted + auth_tag, None)
        return json.loads(plaintext.decode())
    except Exception as e:
        raise ValueError(f"Decryption failed: {e}")


def is_encrypted(body: dict) -> bool:
    return bool(
        body
        and "encryptedData" in body
        and "iv" in body
        and "authTag" in body
    )
