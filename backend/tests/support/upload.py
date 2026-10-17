"""Upload signature helper: every test that needs a storage key mints one through the API."""


async def upload_key(client, headers, purpose: str) -> str:
    response = await client.post("/api/v1/uploads/signature", headers=headers, json={"purpose": purpose})
    assert response.status_code == 200
    return response.json()["key"]
