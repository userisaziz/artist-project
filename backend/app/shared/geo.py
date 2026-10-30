"""Distances on the map, computed in SQL."""

from sqlalchemy import ColumnElement, ColumnExpressionArgument, Float, cast, func, literal

EARTH_RADIUS_KM = 6371.0


def distance_km(
    lat_column: ColumnExpressionArgument[float], lng_column: ColumnExpressionArgument[float], lat: float, lng: float
) -> ColumnElement[float]:
    """Great-circle (haversine) kilometres from (lat, lng) to the row's (lat_column, lng_column); NULL if either is."""
    lat1, lng1 = func.radians(literal(lat)), func.radians(literal(lng))
    lat2, lng2 = func.radians(lat_column), func.radians(lng_column)
    a = func.power(func.sin((lat2 - lat1) / 2), 2) + func.cos(lat1) * func.cos(lat2) * func.power(
        func.sin((lng2 - lng1) / 2), 2
    )
    return cast(2 * EARTH_RADIUS_KM * func.asin(func.sqrt(a)), Float)
