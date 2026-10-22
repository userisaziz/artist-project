"""Catalog support: seeding the design's category tree and reading it back."""

from sqlalchemy import text

CATEGORIES = [
    ("mehendi", "Mehendi"),
    ("makeup", "Makeup"),
    ("hair", "Hair"),
    ("photography", "Photography"),
    ("decor", "Decor"),
    ("tattoo", "Tattoo"),
]


async def seed_categories(engine) -> None:
    """Admins build the catalog in the admin app; tests insert the design's six categories directly,
    plus Mehendi › Bridal and Makeup › Party with a few services so onboarding has something to pick,
    and a few city areas for the Location step."""
    async with engine.begin() as conn:
        ids = {}
        for i, (slug, name) in enumerate(CATEGORIES):
            ids[slug] = (
                await conn.execute(
                    text(
                        "INSERT INTO catalog_category (slug, name, sort_order, status) VALUES (:s, :n, :i, 'active') RETURNING id"
                    ),
                    {"s": slug, "n": name, "i": i},
                )
            ).scalar_one()
        for parent, slug, name, services in (
            ("mehendi", "mehendi-bridal", "Bridal", ("Bridal Classic", "Bridal Full Arms")),
            ("makeup", "makeup-party", "Party", ("Party Makeup",)),
        ):
            sub = (
                await conn.execute(
                    text(
                        "INSERT INTO catalog_category (slug, name, sort_order, parent_id, status) VALUES (:s, :n, 0, :p, 'active') RETURNING id"
                    ),
                    {"s": slug, "n": name, "p": ids[parent]},
                )
            ).scalar_one()
            for i, service in enumerate(services):
                await conn.execute(
                    text("INSERT INTO catalog_service_template (subcategory_id, name, sort_order) VALUES (:s, :n, :i)"),
                    {"s": sub, "n": service, "i": i},
                )
    await seed_areas(engine)  # the artist Location step picks from these


async def categories(client) -> dict[str, int]:
    return {c["slug"]: c["id"] for c in (await client.get("/api/v1/categories")).json()}


async def templates(client) -> dict[str, int]:
    """Service name → template id, from the public catalog tree."""
    tree = (await client.get("/api/v1/categories")).json()
    return {s["name"]: s["id"] for c in tree for sub in c["subcategories"] for s in sub["services"]}


async def create_category(client, headers, **body) -> dict:
    response = await client.post("/api/v1/admin/categories", headers=headers, json=body)
    assert response.status_code == 201, response.json()
    return response.json()


# (city, name, latitude, longitude): a few real areas, as the catalog_area migration seeds them.
AREAS = [
    ("Bangalore", "Koramangala", 12.9352, 77.6245),
    ("Bangalore", "BTM Layout", 12.9166, 77.6101),
    ("Pune", "Baner", 18.5590, 73.7868),
]


async def seed_areas(engine) -> None:
    """The migration seeds every operating city's areas; tests truncate between runs, so they insert a few."""
    async with engine.begin() as conn:
        for city, name, lat, lng in AREAS:
            await conn.execute(
                text(
                    "INSERT INTO catalog_area (city, name, latitude, longitude) VALUES (:c, :n, :la, :lo) "
                    "ON CONFLICT (city, name) DO NOTHING"
                ),
                {"c": city, "n": name, "la": lat, "lo": lng},
            )


async def area_id(client, city: str, name: str) -> int:
    """The id of a seeded area, looked up the way the app does (GET /areas?city=)."""
    areas = (await client.get("/api/v1/areas", params={"city": city})).json()
    return next(a["id"] for a in areas if a["name"] == name)
