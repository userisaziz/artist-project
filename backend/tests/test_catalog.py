"""Catalog contract: the admin's service list under each subcategory, and the public category tree."""

from tests.test_admin import admin, create_category
from tests.test_artists import complete_profile, seed_categories, sign_in

TEMPLATES = "/api/v1/admin/service-templates"


async def create_template(client, headers, **body) -> dict:
    response = await client.post(TEMPLATES, headers=headers, json=body)
    assert response.status_code == 201, response.json()
    return response.json()


async def makeup_bridal(client, headers) -> tuple[dict, dict]:
    makeup = await create_category(client, headers, name="Makeup")
    return makeup, await create_category(client, headers, name="Bridal", parent_id=makeup["id"])


async def test_template_crud(client, engine):
    headers = await admin(client, engine)
    _, bridal = await makeup_bridal(client, headers)
    hd = await create_template(client, headers, subcategory_id=bridal["id"], name=" HD Bridal Makeup ", description="Long-wear HD base")
    assert hd | {"id": 0} == {
        "id": 0, "subcategory_id": bridal["id"], "name": "HD Bridal Makeup", "description": "Long-wear HD base",
        "sort_order": 0, "is_active": True, "artist_count": 0,
    }
    airbrush = await create_template(client, headers, subcategory_id=bridal["id"], name="Airbrush Bridal")
    assert airbrush["sort_order"] == 1

    patched = await client.patch(f"{TEMPLATES}/{hd['id']}", headers=headers, json={"name": "HD Bridal", "description": None, "is_active": False})
    assert patched.status_code == 200
    assert (patched.json()["name"], patched.json()["description"], patched.json()["is_active"]) == ("HD Bridal", None, False)

    listed = (await client.get(f"{TEMPLATES}?subcategory_id={bridal['id']}", headers=headers)).json()
    assert [t["name"] for t in listed] == ["HD Bridal", "Airbrush Bridal"]
    assert (await client.get("/api/v1/admin/categories", headers=headers)).json()[1]["template_count"] == 2

    assert (await client.delete(f"{TEMPLATES}/{airbrush['id']}", headers=headers)).status_code == 204
    assert (await client.delete(f"{TEMPLATES}/{airbrush['id']}", headers=headers)).status_code == 404
    assert (await client.patch(f"{TEMPLATES}/999999", headers=headers, json={"name": "X"})).status_code == 404


async def test_templates_sit_under_subcategories_with_unique_names(client, engine):
    headers = await admin(client, engine)
    makeup, bridal = await makeup_bridal(client, headers)
    template = await create_template(client, headers, subcategory_id=bridal["id"], name="HD Bridal Makeup")

    dupe = await client.post(TEMPLATES, headers=headers, json={"subcategory_id": bridal["id"], "name": "hd bridal makeup"})
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
    headers = await admin(client, engine)
    makeup = await create_category(client, headers, name="Makeup", status="active")
    bridal = await create_category(client, headers, name="Bridal", parent_id=makeup["id"], status="active")
    party = await create_category(client, headers, name="Party", parent_id=makeup["id"], status="inactive")
    hd = await create_template(client, headers, subcategory_id=bridal["id"], name="HD Bridal Makeup", description="Long-wear HD base")
    await create_template(client, headers, subcategory_id=bridal["id"], name="Old look", is_active=False)
    await create_template(client, headers, subcategory_id=party["id"], name="Party glam")
    hair = await create_category(client, headers, name="Hair", status="inactive")
    styling = await create_category(client, headers, name="Styling", parent_id=hair["id"], status="active")
    await create_template(client, headers, subcategory_id=styling["id"], name="Blow dry")
    await create_category(client, headers, name="Nails")  # draft: never public

    tree = (await client.get("/api/v1/categories")).json()
    assert tree == [{
        "id": makeup["id"], "slug": "makeup", "name": "Makeup",
        "subcategories": [{
            "id": bridal["id"], "slug": "makeup-bridal", "name": "Bridal",
            "services": [{"id": hd["id"], "name": "HD Bridal Makeup", "description": "Long-wear HD base"}],
        }],
    }]


async def test_template_in_use_counts_artists_and_cannot_be_deleted(client, engine):
    await seed_categories(engine)
    artist = await sign_in(client, "+919845030001")
    await complete_profile(client, artist, photos=0, kyc=False)
    headers = await admin(client, engine)
    sub_id = next(c["id"] for c in (await client.get("/api/v1/admin/categories", headers=headers)).json() if c["slug"] == "mehendi-bridal")
    listed = (await client.get(f"{TEMPLATES}?subcategory_id={sub_id}", headers=headers)).json()
    classic = next(t for t in listed if t["name"] == "Bridal Classic")
    assert classic["artist_count"] == 1
    response = await client.delete(f"{TEMPLATES}/{classic['id']}", headers=headers)
    assert response.status_code == 409
