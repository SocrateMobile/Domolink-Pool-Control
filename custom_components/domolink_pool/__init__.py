"""DomoLink Pool Control — Contrôle de piscine basé sur vos propres capteurs."""

import logging
from datetime import timedelta
from homeassistant.core import HomeAssistant, callback, ServiceCall
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.components import frontend
from homeassistant.helpers.event import async_track_state_change_event
import os
import datetime

try:
    from homeassistant.components.http import StaticPathConfig
except ImportError:
    StaticPathConfig = None  # type: ignore[misc,assignment]

from .const import DOMAIN, PLATFORMS, NAME, VERSION
from .chemistry import compute_all_chemistry

_LOGGER = logging.getLogger(__name__)

class DomolinkPoolCoordinator(DataUpdateCoordinator):
    """Coordinateur qui aggrège les données des capteurs de la piscine."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry):
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=5),
        )
        self.entry = entry

    async def _async_update_data(self):
        """Récupère l'état des capteurs configurés."""
        data = self.entry.data
        options = self.entry.options

        # Fetch entities
        ph_ent = self.hass.states.get(data.get("ph_entity", ""))
        water_ent = self.hass.states.get(data.get("water_temp_entity", ""))
        orp_ent = self.hass.states.get(data.get("orp_entity", ""))
        air_ent = self.hass.states.get(data.get("air_temp_entity", ""))
        uv_ent = self.hass.states.get(data.get("uv_entity", ""))

        def safe_float(state):
            try:
                return float(state.state) if state and state.state not in ("unavailable", "unknown") else None
            except:
                return None

        ph = safe_float(ph_ent)
        water_temp = safe_float(water_ent)
        orp = safe_float(orp_ent)
        air_temp = safe_float(air_ent)
        uv = safe_float(uv_ent)

        base_data = {
            "ph": ph,
            "temperature": water_temp,
            "redox": orp,
            "air_temp": air_temp,
            "uv_index": uv,
            "last_update": datetime.datetime.now().isoformat()
        }

        # Calculate chemistry
        try:
            chem = compute_all_chemistry(base_data, options)
            base_data.update(chem)
        except Exception as e:
            _LOGGER.error(f"DomoLink Pool Control: Erreur lors du calcul de la chimie: {e}")

        return base_data

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Configuration de DomoLink Pool Control."""
    hass.data.setdefault(DOMAIN, {})

    coordinator = DomolinkPoolCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN][entry.entry_id] = {
        "coordinator": coordinator
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # 1. Enregistrer le chemin statique pour le frontend
    frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
    if os.path.exists(frontend_dir):
        if hasattr(hass.http, "async_register_static_paths") and StaticPathConfig is not None:
            try:
                await hass.http.async_register_static_paths(
                    [
                        StaticPathConfig("/domolink_pool_panel", frontend_dir, cache_headers=False),
                        StaticPathConfig("/domolink_pool_frontend", frontend_dir, cache_headers=False),
                    ]
                )
            except Exception as e:
                _LOGGER.debug("DomoLink Pool Control: Erreur lors de l'enregistrement des static paths async: %s", e)
        elif hasattr(hass.http, "register_static_path"):
            try:
                hass.http.register_static_path(
                    "/domolink_pool_panel",
                    frontend_dir,
                    cache_headers=False,
                )
                hass.http.register_static_path(
                    "/domolink_pool_frontend",
                    frontend_dir,
                    cache_headers=False,
                )
            except Exception as e:
                _LOGGER.debug("DomoLink Pool Control: Erreur lors de l'enregistrement des static paths: %s", e)

    # 2. Enregistrer le panel frontend
    panel_url = f"/domolink_pool_panel/domolink_pool-panel.js?v={VERSION}"
    try:
        frontend.async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title=NAME,
            sidebar_icon="mdi:pool",
            frontend_url_path="domolink_pool",
            config={
                "_panel_custom": {
                    "name": "domolink-pool-panel",
                    "module_url": panel_url,
                }
            },
            require_admin=False,
            update=True,
        )
    except Exception as e:
        _LOGGER.debug("DomoLink Pool Control: Panel frontend déjà enregistré ou erreur: %s", e)

    # 3. Service de rafraîchissement forcé
    async def async_handle_force_sync(call: ServiceCall) -> None:
        """Force refresh of coordinator data."""
        for entry_data in hass.data.get(DOMAIN, {}).values():
            coord = entry_data.get("coordinator")
            if coord:
                await coord.async_request_refresh()

    if not hass.services.has_service(DOMAIN, "force_cloud_sync"):
        hass.services.async_register(DOMAIN, "force_cloud_sync", async_handle_force_sync)

    # Listeners pour mettre à jour automatiquement dès qu'un capteur change
    @callback
    def _async_state_changed(event):
        hass.async_create_task(coordinator.async_request_refresh())

    entities_to_track = [
        entry.data.get("ph_entity"),
        entry.data.get("water_temp_entity"),
        entry.data.get("orp_entity"),
        entry.data.get("air_temp_entity"),
        entry.data.get("uv_entity"),
    ]
    entities_to_track = [e for e in entities_to_track if e]
    if entities_to_track:
        entry.async_on_unload(
            async_track_state_change_event(hass, entities_to_track, _async_state_changed)
        )

    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Déchargement."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok

async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Rechargement."""
    await hass.config_entries.async_reload(entry.entry_id)
