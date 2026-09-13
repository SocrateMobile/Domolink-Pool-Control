"""Constantes pour DomoLink Pool Control."""
from homeassistant.const import Platform

DOMAIN = "domolink_pool"

PLATFORMS = [
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
    Platform.UPDATE,
]

# Chimie
CONF_TAC = "tac"
CONF_TH = "th"
CONF_CYA = "cya"
CONF_TDS = "tds"

DEFAULT_TAC = 100
DEFAULT_TH = 200
DEFAULT_CYA = 30
DEFAULT_TDS = 500
