from datetime import date

from fastapi import APIRouter, Depends, Path

from app.artist.dependencies import get_schedule_service
from app.artist.schedule_service import ScheduleService
from app.artist.schemas import ScheduleIn, ScheduleOut
from app.core.auth import current_artist
from app.shared.responses import errors
from app.user.models import User

# Any artist with a profile, whatever its review status. Every write returns the whole schedule.
router = APIRouter(prefix="/artists/me/schedule", tags=["artist schedule"], responses=errors(401, 403, 404, 422))

DAY = Path(description="An IST calendar date, YYYY-MM-DD")


@router.get("", response_model=ScheduleOut, status_code=200, summary="My working hours, days off and travel radius")
async def get_schedule(
    user: User = Depends(current_artist), schedule: ScheduleService = Depends(get_schedule_service)
) -> dict:
    return await schedule.get(user)


@router.put("", response_model=ScheduleOut, status_code=200, summary="Save my weekly hours and travel radius")
async def save_schedule(
    body: ScheduleIn, user: User = Depends(current_artist), schedule: ScheduleService = Depends(get_schedule_service)
) -> dict:
    return await schedule.save(user, body)


@router.put(
    "/days-off/{day}",
    response_model=ScheduleOut,
    status_code=200,
    summary="Take a day off (stops new bookings; existing ones stay)",
)
async def add_day_off(
    day: date = DAY, user: User = Depends(current_artist), schedule: ScheduleService = Depends(get_schedule_service)
) -> dict:
    return await schedule.add_day_off(user, day)


@router.delete("/days-off/{day}", response_model=ScheduleOut, status_code=200, summary="Work on a day off after all")
async def remove_day_off(
    day: date = DAY, user: User = Depends(current_artist), schedule: ScheduleService = Depends(get_schedule_service)
) -> dict:
    return await schedule.remove_day_off(user, day)
