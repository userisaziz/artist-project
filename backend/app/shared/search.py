"""Helpers for case-insensitive substring search."""


def like_pattern(text: str) -> str:
    """`%text%` for ILIKE with `escape="\\"`: the user's own % and _ match literally."""
    escaped = text.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
