"""Storage seam: Cloudinary signing matches the documented algorithm; keys stay in the owner's folder."""

import uuid

from app.services.storage import CloudinaryStorage, FakeStorage


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
