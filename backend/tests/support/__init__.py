"""Domain-wise test support, mirroring `app/<domain>`: identity, catalog, uploads,
artist onboarding, directory time, and booking flows.

Catalog seeding is deliberately NOT global: the admin/catalog tests build the
category tree themselves from an empty table, so each test module that wants the
seeded six-category catalog opts in with its own autouse fixture.
"""
