"""Catalog contract: the admin's service list under each subcategory, the public category tree, and areas."""

from sqlalchemy import text

from app.geocoder.dependencies import get_geocoder
from app.geocoder.schemas import Place
from tests.support.artist import complete_profile
from tests.support.auth import admin_headers, sign_in
from tests.support.catalog import create_category, seed_areas, seed_categories

TEMPLATES = "/api/v1/admin/service-templates"


async def create_template(client, headers, **body) -> dict:
    response = await client.post(TEMPLATES, headers=headers, json=body)
    assert response.status_code == 201, response.json()
    return response.json()


async def makeup_bridal(client, headers) -> tuple[dict, dict]:
    makeup = await create_category(client, headers, name="Makeup")
    return makeup, await create_category(client, headers, name="Bridal", parent_id=makeup["id"])


async def test_template_crud(client, engine):
    headers = await admin_headers(client, engine)
    _, bridal = await makeup_bridal(client, headers)
    hd = await create_template(
        client, headers, subcategory_id=bridal["id"], name=" HD Bridal Makeup ", description="Long-wear HD base"
    )
    assert hd | {"id": 0} == {
        "id": 0,
        "subcategory_id": bridal["id"],
        "name": "HD Bridal Makeup",
        "description": "Long-wear HD base",
        "sort_order": 0,
        "is_active": True,
        "artist_count": 0,
    }
    airbrush = await create_template(client, headers, subcategory_id=bridal["id"], name="Airbrush Bridal")
    assert airbrush["sort_order"] == 1

    patched = await client.patch(
        f"{TEMPLATES}/{hd['id']}", headers=headers, json={"name": "HD Bridal", "description": None, "is_active": False}
    )
    assert patched.status_code == 200
    assert (patched.json()["name"], patched.json()["description"], patched.json()["is_active"]) == (
        "HD Bridal",
        None,
        False,
    )

    listed = (await client.get(f"{TEMPLATES}?subcategory_id={bridal['id']}", headers=headers)).json()
    assert [t["name"] for t in listed] == ["HD Bridal", "Airbrush Bridal"]
    assert (await client.get("/api/v1/admin/categories", headers=headers)).json()[1]["template_count"] == 2

    assert (await client.delete(f"{TEMPLATES}/{airbrush['id']}", headers=headers)).status_code == 204
    assert (await client.delete(f"{TEMPLATES}/{airbrush['id']}", headers=headers)).status_code == 404
    assert (await client.patch(f"{TEMPLATES}/999999", headers=headers, json={"name": "X"})).status_code == 404


async def test_templates_sit_under_subcategories_with_unique_names(client, engine):
    headers = await admin_headers(client, engine)
    makeup, bridal = await makeup_bridal(client, headers)
    template = await create_template(client, headers, subcategory_id=bridal["id"], name="HD Bridal Makeup")

    dupe = await client.post(
        TEMPLATES, headers=headers, json={"subcategory_id": bridal["id"], "name": "hd bridal makeup"}
    )
    assert dupe.status_code == 409
    top_level = await client.post(TEMPLATES, headers=headers, json={"subcategory_id": makeup["id"], "name": "Party"})
    assert top_level.status_code == 422
    assert top_level.json()["code"] == "validation_error"
    unknown = await client.get(f"{TEMPLATES}?subcategory_id=999999", headers=headers)
    assert unknown.status_code == 422

    whitespace = await client.post(TEMPLATES, headers=headers, json={"subcategory_id": bridal["id"], "name": "   "})
    assert whitespace.status_code == 422
    assert whitespace.json()["code"] == "validation_error"

    patch_whitespace = await client.patch(f"{TEMPLATES}/{template['id']}", headers=headers, json={"name": "   "})
    assert patch_whitespace.status_code == 422
    assert patch_whitespace.json()["code"] == "validation_error"


async def test_public_catalog_is_a_tree_of_active_items(client, engine):
    headers = await admin_headers(client, engine)
    makeup = await create_category(client, headers, name="Makeup", status="active")
    bridal = await create_category(client, headers, name="Bridal", parent_id=makeup["id"], status="active")
    party = await create_category(client, headers, name="Party", parent_id=makeup["id"], status="inactive")
    hd = await create_template(
        client, headers, subcategory_id=bridal["id"], name="HD Bridal Makeup", description="Long-wear HD base"
    )
    await create_template(client, headers, subcategory_id=bridal["id"], name="Old look", is_active=False)
    await create_template(client, headers, subcategory_id=party["id"], name="Party glam")
    hair = await create_category(client, headers, name="Hair", status="inactive")
    styling = await create_category(client, headers, name="Styling", parent_id=hair["id"], status="active")
    await create_template(client, headers, subcategory_id=styling["id"], name="Blow dry")
    await create_category(client, headers, name="Nails")  # draft: never public

    tree = (await client.get("/api/v1/categories")).json()
    assert tree == [
        {
            "id": makeup["id"],
            "slug": "makeup",
            "name": "Makeup",
            "subcategories": [
                {
                    "id": bridal["id"],
                    "slug": "makeup-bridal",
                    "name": "Bridal",
                    "services": [{"id": hd["id"], "name": "HD Bridal Makeup", "description": "Long-wear HD base"}],
                }
            ],
        }
    ]


async def test_template_in_use_counts_artists_and_cannot_be_deleted(client, engine):
    await seed_categories(engine)
    artist = await sign_in(client, "+919845030001")
    await complete_profile(client, artist, photos=0, kyc=False)
    headers = await admin_headers(client, engine)
    sub_id = next(
        c["id"]
        for c in (await client.get("/api/v1/admin/categories", headers=headers)).json()
        if c["slug"] == "mehendi-bridal"
    )
    listed = (await client.get(f"{TEMPLATES}?subcategory_id={sub_id}", headers=headers)).json()
    classic = next(t for t in listed if t["name"] == "Bridal Classic")
    assert classic["artist_count"] == 1
    response = await client.delete(f"{TEMPLATES}/{classic['id']}", headers=headers)
    assert response.status_code == 409


AREAS = "/api/v1/areas"


async def test_areas_of_a_city_in_name_order(client, engine):
    await seed_areas(engine)

    bangalore = (await client.get(AREAS, params={"city": "Bangalore"})).json()
    nowhere = (await client.get(AREAS, params={"city": "Atlantis"})).json()

    assert [a["name"] for a in bangalore] == ["BTM Layout", "Koramangala"]
    assert set(bangalore[0]) == {"id", "city", "name", "latitude", "longitude"}
    assert nowhere == []
    assert (await client.get(AREAS)).status_code == 422


async def test_a_pin_snaps_to_the_nearest_area_within_reach(client, engine):
    await seed_areas(engine)

    near_btm = await client.get(f"{AREAS}/nearest", params={"lat": 12.9180, "lng": 77.6120})
    far_away = await client.get(f"{AREAS}/nearest", params={"lat": 13.5, "lng": 77.0})

    assert near_btm.status_code == 200
    assert (near_btm.json()["name"], near_btm.json()["city"]) == ("BTM Layout", "Bangalore")
    assert far_away.status_code == 200 and far_away.json() is None  # outside every area: the artist picks by hand
    assert (await client.get(f"{AREAS}/nearest", params={"lat": 95, "lng": 77.0})).status_code == 422


class FakeGeocoder:
    """Stands in for the external geocoder: answers with `places` and records every search."""

    def __init__(self, places: list[Place] | None = None):
        self.places = places or []
        self.calls: list[tuple[str, tuple[float, float] | None]] = []

    async def search(self, q: str, near: tuple[float, float] | None = None) -> list[Place]:
        self.calls.append((q, near))
        return self.places


async def test_area_search_answers_from_catalog_areas_first(client, engine, override):
    await seed_areas(engine)
    async with engine.begin() as conn:
        for name, active in (("Banashankari", True), ("Old Banjara", True), ("Banaswadi", False)):
            await conn.execute(
                text(
                    "INSERT INTO catalog_area (city, name, latitude, longitude, is_active) VALUES ('Bangalore', :n, 12.9, 77.6, :a)"
                ),
                {"n": name, "a": active},
            )
    geocoder = FakeGeocoder([Place(name="Ignored", label="Ignored", city=None, lat=1.0, lon=1.0)])
    override(get_geocoder, lambda: geocoder)

    response = await client.get(f"{AREAS}/search", params={"q": "BAN"})
    btm = (await client.get(f"{AREAS}/search", params={"q": "btm"})).json()

    assert response.status_code == 200
    # Names starting with the query first, then by name; inactive areas never; city names don't match.
    assert [r["name"] for r in response.json()] == ["Banashankari", "Baner", "Old Banjara"]
    assert btm == [
        {
            "label": "BTM Layout, Bangalore",
            "name": "BTM Layout",
            "city": "Bangalore",
            "latitude": 12.9166,
            "longitude": 77.6101,
            "area_id": btm[0]["area_id"],
            "source": "area",
        }
    ]
    assert isinstance(btm[0]["area_id"], int)
    assert geocoder.calls == []  # an area matched, so the geocoder is never asked


async def test_area_search_falls_back_to_the_geocoder_snapping_to_the_nearest_area(client, engine, override):
    await seed_areas(engine)
    geocoder = FakeGeocoder(
        [
            Place(
                name="Udupi Garden",
                label="Udupi Garden, BTM 2nd Stage, Bengaluru",
                city="Bengaluru",
                lat=12.918,
                lon=77.612,
            ),
            Place(name="Nandi Hills", label="Nandi Hills, Karnataka", city=None, lat=13.37, lon=77.68),
        ]
    )
    override(get_geocoder, lambda: geocoder)

    response = await client.get(f"{AREAS}/search", params={"q": "udupi garden", "lat": 12.93, "lng": 77.62})
    btm_id = (await client.get(f"{AREAS}/nearest", params={"lat": 12.9166, "lng": 77.6101})).json()["id"]

    assert response.status_code == 200
    near, far = response.json()
    assert near == {
        "label": "Udupi Garden, BTM 2nd Stage, Bengaluru",
        "name": "Udupi Garden",
        "city": "Bengaluru",
        "latitude": 12.918,
        "longitude": 77.612,
        "area_id": btm_id,
        "source": "geocoder",
    }
    assert (far["area_id"], far["source"], far["city"]) == (None, "geocoder", None)  # beyond every area
    assert geocoder.calls == [("udupi garden", (12.93, 77.62))]


async def test_area_search_with_nothing_found_is_empty(client, engine, override):
    await seed_areas(engine)
    override(get_geocoder, lambda: FakeGeocoder())

    response = await client.get(f"{AREAS}/search", params={"q": "atlantis"})

    assert (response.status_code, response.json()) == (200, [])


async def test_area_search_validates_its_query(client):
    for params in ({"q": "bt"}, {"q": "x" * 81}, {}, {"q": "btm", "lat": 12.9}, {"q": "btm", "lat": 95, "lng": 77}):
        assert (await client.get(f"{AREAS}/search", params=params)).status_code == 422, params
