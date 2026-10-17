"""Storage seam: Cloudinary signing matches the documented algorithm; keys stay in the owner's folder."""

import time
import uuid
from urllib.parse import parse_qs, urlparse

from app.modules.uploads.storage import CloudinaryStorage, FakeStorage


def test_cloudinary_signature_matches_documented_example():
    # https://cloudinary.com/documentation/authentication_signatures (manual signature example)
    storage = CloudinaryStorage("demo", "key", "abcd")
    params = {"eager": "w_400,h_300,c_pad|w_260,h_200,c_crop", "public_id": "sample_image", "timestamp": "1315060510"}
    assert storage.sign(params) == "bfd09f95f331f558cbd1320e67aa8d488770583e"


def test_cloudinary_upload_form_pins_the_key():
    storage = CloudinaryStorage("demo", "key", "secret")
    owner = uuid.uuid4()
    form = storage.upload_params(owner, "portfolio")
    assert form["upload_url"] == "https://api.cloudinary.com/v1_1/demo/image/upload"
    assert form["fields"]["public_id"] == form["key"]
    assert form["key"].startswith(f"artists/{owner}/portfolio/")
    signed = {k: form["fields"][k] for k in ("public_id", "timestamp", "allowed_formats")}
    assert form["fields"]["signature"] == storage.sign(signed)
    assert storage.url(form["key"], "thumb").startswith("https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_240")


def test_owns_rejects_other_folders_and_tricks():
    storage, owner = FakeStorage(), uuid.uuid4()
    key = storage.upload_params(owner, "portfolio")["key"]
    assert storage.owns(key, owner, "portfolio")
    assert not storage.owns(key, owner, "artist_photo")
    assert not storage.owns(key, uuid.uuid4(), "portfolio")
    assert not storage.owns(f"{key}/../../x", owner, "portfolio")
    assert not storage.owns(f"artists/{owner}/portfolio/../{uuid.uuid4()}/portfolio/{'a' * 20}", owner, "portfolio")


def test_aadhaar_upload_is_private_and_signed():
    storage = CloudinaryStorage("demo", "key", "secret")
    owner = uuid.uuid4()
    form = storage.upload_params(owner, "aadhaar")
    assert form["key"].startswith(f"artists/{owner}/aadhaar/")
    assert form["fields"]["type"] == "private"
    signed = {k: form["fields"][k] for k in ("public_id", "timestamp", "allowed_formats", "type")}
    assert form["fields"]["signature"] == storage.sign(signed)
    # other purposes stay public
    assert "type" not in storage.upload_params(owner, "portfolio")["fields"]


def test_cloudinary_private_url_is_a_signed_expiring_download():
    storage = CloudinaryStorage("demo", "key", "secret")
    before = int(time.time())
    url = urlparse(storage.private_url("artists/x/aadhaar/abc", expires_in=300))
    assert (url.scheme, url.netloc, url.path) == ("https", "api.cloudinary.com", "/v1_1/demo/image/download")
    q = {k: v[0] for k, v in parse_qs(url.query).items()}
    assert q["public_id"] == "artists/x/aadhaar/abc"
    assert q["type"] == "private"
    assert q["format"] == "jpg"
    assert q["api_key"] == "key"
    assert before + 300 <= int(q["expires_at"]) <= int(time.time()) + 300
    signed = {k: q[k] for k in ("public_id", "format", "type", "timestamp", "expires_at")}
    assert q["signature"] == storage.sign(signed)


def test_fake_storage_private_url_and_owns_aadhaar():
    storage, owner = FakeStorage(), uuid.uuid4()
    key = storage.upload_params(owner, "aadhaar")["key"]
    assert storage.owns(key, owner, "aadhaar")
    assert not storage.owns(key, owner, "portfolio")
    assert storage.private_url(key).startswith(f"https://fake.storage/private/{key}.jpg?expires_at=")
