"""Storage seam: Cloudinary signing matches the documented algorithm; keys stay in the owner's folder."""

import time
import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from botocore.exceptions import EndpointConnectionError
from pydantic import ValidationError

from app.upload.config import UploadSettings
from app.upload.service import CloudinaryStorage, FakeStorage, R2Storage, r2_client


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
    assert storage.url(form["key"], "thumb").startswith(
        "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_240"
    )


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


def _r2(client=None) -> R2Storage:
    return R2Storage(client or r2_client("acct", "key-id", "secret"), "pics", "pics-private", "https://pub-abc.r2.dev/")


def test_r2_upload_is_a_presigned_put_pinned_to_the_key_and_jpeg():
    owner = uuid.uuid4()
    ticket = _r2().upload_params(owner, "portfolio")
    url = urlparse(ticket["upload_url"])
    q = parse_qs(url.query)
    assert ticket["method"] == "PUT"
    assert ticket["fields"] == {}
    assert ticket["headers"] == {"Content-Type": "image/jpeg"}
    assert ticket["key"].startswith(f"artists/{owner}/portfolio/")
    assert url.netloc == "acct.r2.cloudflarestorage.com"
    assert url.path == f"/pics/{ticket['key']}"
    assert q["X-Amz-Algorithm"] == ["AWS4-HMAC-SHA256"]
    assert "content-type" in q["X-Amz-SignedHeaders"][0]  # another file type breaks the signature
    assert q["X-Amz-Expires"] == [str(R2Storage.UPLOAD_TTL_SECONDS)]


def test_r2_aadhaar_goes_to_the_private_bucket():
    ticket = _r2().upload_params(uuid.uuid4(), "aadhaar")
    assert urlparse(ticket["upload_url"]).path == f"/pics-private/{ticket['key']}"


def test_r2_every_variant_is_the_public_original():
    storage = _r2()
    assert {storage.url("artists/x/portfolio/abc", v) for v in ("thumb", "card", "full")} == {
        "https://pub-abc.r2.dev/artists/x/portfolio/abc"
    }


def test_r2_private_url_is_a_presigned_get_from_the_private_bucket():
    url = urlparse(_r2().private_url("artists/x/aadhaar/abc", expires_in=300))
    q = parse_qs(url.query)
    assert url.path == "/pics-private/artists/x/aadhaar/abc"
    assert q["X-Amz-Expires"] == ["300"]
    assert "X-Amz-Signature" in q


class _RecordingS3:
    """Stands in for the boto3 client: records deletes, or fails them."""

    def __init__(self, error: Exception | None = None):
        self.deleted: list[tuple[str, str]] = []
        self.error = error

    def delete_object(self, *, Bucket: str, Key: str) -> None:
        if self.error:
            raise self.error
        self.deleted.append((Bucket, Key))


async def test_r2_delete_targets_the_right_bucket():
    s3 = _RecordingS3()
    storage = _r2(s3)
    await storage.delete("artists/x/portfolio/abc")
    await storage.delete("artists/x/aadhaar/abc", private=True)
    assert s3.deleted == [("pics", "artists/x/portfolio/abc"), ("pics-private", "artists/x/aadhaar/abc")]


async def test_r2_failed_delete_is_logged_not_raised(caplog):
    storage = _r2(_RecordingS3(EndpointConnectionError(endpoint_url="https://acct.r2.cloudflarestorage.com")))
    await storage.delete("artists/x/portfolio/abc")
    assert "R2 delete artists/x/portfolio/abc failed" in caplog.text


def test_r2_settings_need_every_value_and_two_buckets():
    full = {
        "storage_provider": "r2",
        "r2_account_id": "acct",
        "r2_access_key_id": "key-id",
        "r2_secret_access_key": "secret",
        "r2_bucket": "pics",
        "r2_private_bucket": "pics-private",
        "r2_public_url": "https://pub-abc.r2.dev",
    }
    assert UploadSettings(**full).r2_bucket == "pics"
    with pytest.raises(ValidationError, match="R2_PUBLIC_URL"):
        UploadSettings(**{**full, "r2_public_url": ""})
    with pytest.raises(ValidationError, match="separate private bucket"):
        UploadSettings(**{**full, "r2_private_bucket": "pics"})
