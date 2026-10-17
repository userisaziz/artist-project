"""Grant the admin role to a phone number: `python -m scripts.make_admin +919845012345` (from backend/).

Admin is never self-assigned through the API. The role is added alongside any others the
account holds (customer/artist stay as they are); the account is created if the number has
never signed in. The admin then signs in to the admin app with phone + OTP as usual.
"""

import asyncio
import re
import sys

from app.core.database import SessionLocal, engine
from app.shared.enums import UserRole
from app.user.models import User
from app.user.repository import UserRepository


async def make_admin(phone: str) -> str:
    async with SessionLocal() as session:
        user = await UserRepository(session).by_phone(phone)
        created = user is None
        if created:
            user = User(phone=phone, role_grants=[])
            session.add(user)
        user.grant(UserRole.admin)
        await session.commit()
    await engine.dispose()
    return f"{'Created' if created else 'Updated'} admin {phone}"


def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(r"\+[1-9]\d{7,14}", sys.argv[1]):
        sys.exit("usage: python -m scripts.make_admin +<E.164 phone>, e.g. +919845012345")
    print(asyncio.run(make_admin(sys.argv[1])))


if __name__ == "__main__":
    main()
