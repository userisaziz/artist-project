import uuid

from fastapi import APIRouter, Depends, Response

from app.core.auth import get_current_user
from app.shared.responses import errors
from app.user.address_service import AddressService
from app.user.dependencies import get_address_service, get_user_service, valid_owned_address
from app.user.models import User, UserAddress
from app.user.schemas import AccountDetails, AddressIn, AddressOut, AddressPatch, RoleChoice, UserOut
from app.user.service import UserService

router = APIRouter(prefix="/users", tags=["users"], responses=errors(401, 422))


@router.get("/me", response_model=UserOut, status_code=200, summary="Current user")
async def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut, summary="Save sign-up details", status_code=200)
async def update_me(
    body: AccountDetails,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> User:
    return await service.update_details(user, body)


@router.put(
    "/me/role", response_model=UserOut, summary="Pick or switch the app side (customer or artist)", status_code=200
)
async def choose_role(
    body: RoleChoice,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> User:
    return await service.choose_role(user, body)


@router.delete(
    "/me",
    status_code=204,
    response_class=Response,
    summary="Delete my account",
    description=(
        "Cancels upcoming bookings and unshipped orders (the other side is notified), suspends and blanks the "
        "artist profile with its photos, KYC, posts and products, ends every session and anonymises the account. "
        "Past bookings, orders, reviews and chats are kept. The phone number can sign up again as a new account."
    ),
)
async def delete_me(user: User = Depends(get_current_user), service: UserService = Depends(get_user_service)) -> None:
    await service.delete_account(user)


@router.get(
    "/me/addresses",
    response_model=list[AddressOut],
    status_code=200,
    summary="My saved addresses",
    description="Most recently used first, then newest saved.",
)
async def list_addresses(
    user: User = Depends(get_current_user), service: AddressService = Depends(get_address_service)
) -> list[UserAddress]:
    return await service.list(user)


@router.post(
    "/me/addresses",
    response_model=AddressOut,
    status_code=201,
    summary="Save an address",
    description=(
        "201 with the new address. If the same address text is already saved (ignoring case and spacing), "
        "200 with that one, relabelled. 409 past the limit of saved addresses."
    ),
    responses={
        **errors(409),
        200: {"model": AddressOut, "description": "Already saved: the existing address, relabelled"},
    },
)
async def add_address(
    body: AddressIn,
    response: Response,
    user: User = Depends(get_current_user),
    service: AddressService = Depends(get_address_service),
) -> UserAddress:
    address, created = await service.add(user, body)
    if not created:
        response.status_code = 200
    return address


@router.patch(
    "/me/addresses/{address_id}",
    response_model=AddressOut,
    status_code=200,
    summary="Change a saved address",
    responses=errors(404, 409),
)
async def update_address(
    body: AddressPatch,
    user: User = Depends(get_current_user),
    address: UserAddress = Depends(valid_owned_address),
    service: AddressService = Depends(get_address_service),
) -> UserAddress:
    return await service.update(user, address, body)


@router.delete(
    "/me/addresses/{address_id}",
    status_code=204,
    response_class=Response,
    summary="Delete a saved address (idempotent)",
)
async def delete_address(
    address_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: AddressService = Depends(get_address_service),
) -> None:
    await service.delete(user, address_id)


@router.post(
    "/me/addresses/{address_id}/used",
    status_code=204,
    response_class=Response,
    summary="Mark a saved address as just used",
    description="Call when a booking or order uses this address, so it sorts first.",
    responses=errors(404),
)
async def mark_address_used(
    address: UserAddress = Depends(valid_owned_address),
    service: AddressService = Depends(get_address_service),
) -> None:
    await service.mark_used(address)
