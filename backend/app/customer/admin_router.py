import uuid

from fastapi import APIRouter, Depends, Query, Response

from app.core.auth import audited_admin
from app.customer.constants import Segment
from app.customer.dependencies import get_admin_customer_service
from app.customer.schemas import BlockIn, CustomerDetail, CustomerPage, CustomerSummary
from app.customer.service import AdminCustomerService
from app.shared.responses import errors
from app.user.models import User

router = APIRouter(
    prefix="/admin/customers",
    tags=["admin customers"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 409, 422),
)

SEARCH = Query(None, max_length=100, description="Name, phone or email contains")


@router.get("", response_model=CustomerPage, status_code=200, summary="Customer directory, newest first")
async def list_customers(
    segment: Segment = "all",
    q: str | None = SEARCH,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    customers: AdminCustomerService = Depends(get_admin_customer_service),
) -> dict:
    items, next_cursor = await customers.list(segment, q, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/summary", response_model=CustomerSummary, status_code=200, summary="Segment counts and KPIs")
async def customer_summary(customers: AdminCustomerService = Depends(get_admin_customer_service)) -> dict:
    return await customers.summary()


@router.get(
    "/export",
    response_model=str,  # documented as text; the handler returns the CSV Response as is
    status_code=200,
    summary="The filtered directory as CSV",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
async def export_customers(
    segment: Segment = "all",
    q: str | None = SEARCH,
    customers: AdminCustomerService = Depends(get_admin_customer_service),
) -> Response:
    return Response(
        await customers.export_csv(segment, q),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="customers.csv"', "Cache-Control": "no-store"},
    )


@router.get("/{customer_id}", response_model=CustomerDetail, status_code=200, summary="One customer")
async def get_customer(
    customer_id: uuid.UUID, customers: AdminCustomerService = Depends(get_admin_customer_service)
) -> dict:
    return await customers.detail(customer_id)


@router.post("/{customer_id}/block", response_model=CustomerDetail, status_code=200, summary="Block a customer")
async def block_customer(
    customer_id: uuid.UUID,
    body: BlockIn,
    admin: User = Depends(audited_admin),
    customers: AdminCustomerService = Depends(get_admin_customer_service),
) -> dict:
    return await customers.block(admin, customer_id, body.reason)


@router.post("/{customer_id}/unblock", response_model=CustomerDetail, status_code=200, summary="Unblock a customer")
async def unblock_customer(
    customer_id: uuid.UUID, customers: AdminCustomerService = Depends(get_admin_customer_service)
) -> dict:
    return await customers.unblock(customer_id)
