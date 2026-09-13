"""Constants for the DomoLink Pool Control integration."""
from homeassistant.const import Platform

DOMAIN = "domolink_pool"
NAME = "DomoLink Pool Control"
VERSION = "1.0.2"

PLATFORMS = [
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
    Platform.UPDATE,
]

# ── Configuration de traitement ────────────────────────────
PH_TARGET          = 7.4     # pH idéal cible
PH_MINUS_DOSE      = 100.0   # g par m³ par unité pH (granulés bisulfate)
PH_PLUS_DOSE       = 150.0   # g par m³ par unité pH (granulés carbonate)

CHLORINE_TARGET    = 2.0     # mg/L idéal
CHLORINE_SHOCK_TARGET = 5.0  # mg/L cible pour traitement choc
CHLORINE_DOSE      = 1.5     # g de produit par m³ par mg/L (chlore choc 70%)

TAC_TARGET         = 120.0   # mg/L ou ppm (alcalinité idéale cible)
TAC_PLUS_DOSE      = 1.8     # g de TAC+ (bicarbonate) par m³ par mg/L (ppm)

PUMP_MIN_HOURS     = 4.0
PUMP_MAX_HOURS     = 24.0

# ── Paramètres de chimie de l'eau (LSI & Chlore Actif) ────
CONF_TAC           = "tac"     # Alcalinité totale (TAC) en ppm/mg/L
CONF_TH            = "th"      # Titre Hydrotimétrique / dureté en ppm/mg/L
CONF_CYA           = "cya"     # Acide cyanurique / Stabilisant en ppm/mg/L
CONF_TDS           = "tds"     # Total Dissolved Solids / Sels dissous en ppm/mg/L

DEFAULT_TAC        = 100.0     # ppm - alcalinité moyenne de l'eau douce
DEFAULT_TH         = 200.0     # ppm - dureté moyenne de l'eau douce
DEFAULT_CYA        = 30.0      # ppm - stabilisant faible (eau non stabilisée)
DEFAULT_TDS        = 1000.0    # ppm - standard eau douce
