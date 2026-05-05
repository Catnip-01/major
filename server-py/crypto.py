"""
crypto.py — AES-CBC decryption matching the React Native client's crypto.js.
Uses AES-CBC with PKCS7 padding.
"""
import os
import json
import hashlib
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from dotenv import load_dotenv

load_dotenv()

_RAW_KEY = os.getenv("ENCRYPTION_KEY", "palfin-super-secret-key")

# Match crypto-js key derivation (32-byte SHA256 of the string)
ENCRYPTION_KEY = hashlib.sha256(_RAW_KEY.encode()).digest()


def decrypt_payload(payload: dict) -> dict:
    """
    Decrypts a payload of the form:
      { "encryptedData": "hex...", "iv": "hex..." }
    """
    try:
        ciphertext = bytes.fromhex(payload["encryptedData"])
        iv = bytes.fromhex(payload["iv"])

        # Create AES-CBC cipher
        cipher = Cipher(algorithms.AES(ENCRYPTION_KEY), modes.CBC(iv))
        decryptor = cipher.decryptor()
        
        # Decrypt
        padded_plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        
        # Remove PKCS7 padding
        unpadder = padding.PKCS7(128).unpadder()
        plaintext = unpadder.update(padded_plaintext) + unpadder.finalize()
        
        return json.loads(plaintext.decode("utf-8"))
    except Exception as e:
        raise ValueError(f"Decryption failed: {e}")


def is_encrypted(body: dict) -> bool:
    return bool(
        body
        and "encryptedData" in body
        and "iv" in body
    )
