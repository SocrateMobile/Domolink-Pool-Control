"""Chimie et équilibre de l'eau pour DomoLink Pool Control."""
import math
import logging
from typing import Any

from .const import (
    PH_TARGET,
    PH_MINUS_DOSE,
    PH_PLUS_DOSE,
    CHLORINE_TARGET,
    CHLORINE_SHOCK_TARGET,
    CHLORINE_DOSE,
    TAC_TARGET,
    TAC_PLUS_DOSE,
    PUMP_MIN_HOURS,
    PUMP_MAX_HOURS,
    CONF_TAC,
    CONF_TH,
    CONF_CYA,
    CONF_TDS,
    DEFAULT_TAC,
    DEFAULT_TH,
    DEFAULT_CYA,
    DEFAULT_TDS,
)

_LOGGER = logging.getLogger(__name__)

_CYA_HOCl_MAX_FACTOR = 50.0


def _compute_ph_s(temp_c: float, tac_c: float, th_c: float, tds_c: float) -> float:
    # Formule standard LSI simplifiée (Kelvin)
    a = (math.log10(max(1.0, tds_c)) - 1) / 10
    b = -13.12 * math.log10(temp_c + 273.15) + 34.55
    c = math.log10(max(1.0, th_c)) - 0.4
    d = math.log10(max(1.0, tac_c))
    return (9.3 + a + b) - (c + d)


def compute_isl(
    temp: float | None, ph: float | None, tac: float, th: float, tds: float
) -> float | None:
    if any(v is None for v in [temp, ph, tac, th, tds]):
        return None
    if tac <= 0 or th <= 0 or tds <= 0:
        return None
    try:
        ph_s = _compute_ph_s(float(temp), float(tac), float(th), float(tds))
        return round(float(ph) - ph_s, 2)
    except Exception as e:
        _LOGGER.debug("Error computing LSI: %s", e)
        return None


def compute_ph_equilibrium(
    temp: float | None, tac: float, th: float, tds: float
) -> float | None:
    if any(v is None for v in [temp, tac, th, tds]):
        return None
    if tac <= 0 or th <= 0 or tds <= 0:
        return None
    try:
        return round(_compute_ph_s(float(temp), float(tac), float(th), float(tds)), 2)
    except Exception as e:
        _LOGGER.debug("Error computing equilibrium pH: %s", e)
        return None


def estimate_free_chlorine(orp: float | None, ph: float | None, cya: float = 30.0) -> float | None:
    if orp is None or ph is None:
        return None
    try:
        effective_orp = max(415.0, float(orp))
        ph_val = float(ph)
        amplifier = 657 - (51 * ph_val)
        if amplifier < 0.1:
            amplifier = 0.1

        exponent = (effective_orp - 1065 + (50 * ph_val)) / amplifier
        fc_theoretical = math.pow(10, exponent)

        cya_factor = max(1.0, float(cya) / 40.0)
        fc_estimated = fc_theoretical * cya_factor

        return round(max(0.0, min(fc_estimated, 15.0)), 2)
    except (ValueError, OverflowError, ZeroDivisionError, TypeError) as e:
        _LOGGER.debug("Mathematical error in estimate_free_chlorine: %s", e)
        return None


def compute_active_chlorine_from_fc(
    fc_estimated: float | None, ph: float | None, temp_c: float | None, cya: float = 30.0
) -> float | None:
    try:
        if fc_estimated is None or ph is None:
            return None
        if fc_estimated <= 0:
            return 0.0

        temp_val = float(temp_c) if temp_c is not None else 25.0
        temp_c_clamped = max(0.0, min(temp_val, 60.0))
        temp_k = temp_c_clamped + 273.15
        pka = (3000.0 / temp_k) - 10.0686 + (0.0253 * temp_k)
        hocl_fraction = 1.0 / (1.0 + math.pow(10, float(ph) - pka))

        cya_penalty_factor = min(
            1.0 + (max(0.0, float(cya)) * 0.8),
            _CYA_HOCl_MAX_FACTOR,
        )
        active_chlorine = (fc_estimated * hocl_fraction) / cya_penalty_factor

        return round(max(0.0, active_chlorine), 4)
    except Exception as e:
        _LOGGER.debug("Error in compute_active_chlorine_from_fc: %s", e)
        return None


def compute_all_chemistry(base_data: dict[str, Any], options: dict[str, Any]) -> dict[str, Any]:
    """Calcule l'ensemble des indicateurs chimiques, statut et doses recommandées."""
    ph = base_data.get("ph")
    temp = base_data.get("temperature")
    orp = base_data.get("redox")

    tac = float(options.get(CONF_TAC, DEFAULT_TAC))
    th = float(options.get(CONF_TH, DEFAULT_TH))
    cya = float(options.get(CONF_CYA, DEFAULT_CYA))
    tds = float(options.get(CONF_TDS, DEFAULT_TDS))
    pool_volume = float(options.get("pool_volume", 40.0))  # m³

    # 1. LSI
    lsi = compute_isl(temp, ph, tac, th, tds)
    if lsi is None:
        lsi_status = None
    elif lsi < -0.3:
        lsi_status = "corrosive"
    elif lsi > 0.3:
        lsi_status = "entartrante"
    else:
        lsi_status = "équilibrée"

    # 2. pH équilibre
    ph_equilibre = compute_ph_equilibrium(temp, tac, th, tds)

    # 3. Chlore libre et actif
    free_cl = estimate_free_chlorine(orp, ph, cya)
    active_cl = compute_active_chlorine_from_fc(free_cl, ph, temp, cya)

    # 4. Statuts simples
    if ph is None:
        ph_status = "Inconnu"
        ph_simple = "KO"
    elif 7.0 <= ph <= 7.6:
        ph_status = "OK"
        ph_simple = "OK"
    else:
        ph_status = "Ajustement requis"
        ph_simple = "KO"

    if free_cl is None:
        cl_status = "Inconnu"
        cl_simple = "KO"
    elif 0.8 <= free_cl <= 3.0:
        cl_status = "OK"
        cl_simple = "OK"
    else:
        cl_status = "Ajustement requis"
        cl_simple = "KO"

    # 5. Doses de correction
    pool_volume_m3 = pool_volume
    pool_volume_l = round(pool_volume_m3 * 1000) if pool_volume_m3 > 0 else 0

    if ph is not None and pool_volume_m3 > 0:
        ph_diff = ph - PH_TARGET
        if ph_diff > 0:
            dose_ph_minus = round(ph_diff * pool_volume_m3 * PH_MINUS_DOSE)
            dose_ph_plus = 0
        elif ph_diff < 0:
            dose_ph_minus = 0
            dose_ph_plus = round(abs(ph_diff) * pool_volume_m3 * PH_PLUS_DOSE)
        else:
            dose_ph_minus = dose_ph_plus = 0
    else:
        dose_ph_minus = dose_ph_plus = None

    if tac is not None and pool_volume_m3 > 0:
        tac_diff = TAC_TARGET - tac
        dose_tac_plus = round(tac_diff * pool_volume_m3 * TAC_PLUS_DOSE) if tac_diff > 0 else 0
    else:
        dose_tac_plus = None

    if free_cl is not None and pool_volume_m3 > 0:
        cl_diff_maint = CHLORINE_TARGET - free_cl
        cl_diff_shock = CHLORINE_SHOCK_TARGET - free_cl
        dose_cl_maint = round(cl_diff_maint * pool_volume_m3 * CHLORINE_DOSE) if cl_diff_maint > 0 else 0
        dose_cl_shock = round(cl_diff_shock * pool_volume_m3 * CHLORINE_DOSE) if cl_diff_shock > 0 else 0
    else:
        dose_cl_maint = dose_cl_shock = None

    # 6. Temps de filtration
    if temp is not None:
        if free_cl is not None and free_cl < 0.5:
            pump_hours = 24.0
            conseil_filtration = "24h (Choc recommandé)"
        else:
            base_h = temp / 2.0
            malus = 0.0
            if ph is not None:
                if ph < 7.0 or ph > 8.0:
                    malus += 2.0
                elif ph < 7.2 or ph > 7.6:
                    malus += 1.0
            if free_cl is not None and free_cl < 1.0:
                malus += 1.0
            pump_hours = round(max(PUMP_MIN_HOURS, min(PUMP_MAX_HOURS, base_h + malus)), 1)
            conseil_filtration = f"{pump_hours}h"
    else:
        pump_hours = None
        conseil_filtration = None

    return {
        "chlorine": free_cl,
        "free_chlorine": free_cl,
        "active_chlorine": active_cl,
        "lsi": lsi,
        "lsi_status": lsi_status,
        "ph_equilibre": ph_equilibre,
        "ph_status": ph_status,
        "ph_simple": ph_simple,
        "chlorine_status": cl_status,
        "chlorine_simple": cl_simple,
        "dose_ph_minus": dose_ph_minus,
        "dose_ph_plus": dose_ph_plus,
        "dose_tac_plus": dose_tac_plus,
        "dose_cl_maint": dose_cl_maint,
        "dose_cl_shock": dose_cl_shock,
        "pump_hours": pump_hours,
        "conseil_filtration": conseil_filtration,
        "pool_volume": pool_volume_l,
        "water_state": "normal" if (ph_simple == "OK" and cl_simple == "OK") else "warning",
    }
