"""How long the geocoder waits, what it asks for, and how long it remembers an answer."""

TIMEOUT_SECONDS = 3.0
AUTOCOMPLETE_PATH = "/v1/geocode/autocomplete"
COUNTRY_FILTER = "countrycode:in"  # the marketplace operates in India only
RESULT_LIMIT = 10

CACHE_TTL_SECONDS = 24 * 60 * 60  # place names barely change; a day keeps repeat searches off the provider
CACHE_MAX_ENTRIES = 2048
BIAS_DECIMALS = 2  # ~1 km: nearby searchers share cache entries
