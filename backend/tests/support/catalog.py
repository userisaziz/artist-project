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
    plus Mehendi › Bridal and Makeup › Party with a few services so onboarding has something to pick."""
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
