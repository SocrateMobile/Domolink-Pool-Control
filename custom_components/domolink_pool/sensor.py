from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components.sensor import SensorEntity, SensorDeviceClass, SensorStateClass
from homeassistant.helpers.update_coordinator import CoordinatorEntity, DataUpdateCoordinator
from homeassistant.helpers.entity import DeviceInfo, EntityCategory
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from typing import Any
from .const import DOMAIN

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    """Configuration des capteurs (sensors) DomoLink Pool Control."""
    coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    pool_id = entry.entry_id

    sensors_config = [
        # ── 1. 💧 Mesures Instantanées de la Piscine ──────────
        ("temperature",     "temperature",     "°C",    SensorDeviceClass.TEMPERATURE, "mdi:thermometer", None),
        ("ph",              "ph",              "pH",    None,                          "mdi:ph", None),
        ("redox",           "redox",           "mV",    None,                          "mdi:flask-outline", None),
        ("chlorine",        "chlorine",        "mg/L",  None,                          "mdi:water-check", None),
        ("conductivity",    "conductivity",    "µS/cm", None,                          "mdi:lightning-bolt", None),
        ("water_state",     "water_state",     None,    None,                          "mdi:pool", None),
        ("last_update",     "last_update",     None,    SensorDeviceClass.TIMESTAMP,   "mdi:clock-outline", EntityCategory.DIAGNOSTIC),

        # ── 2. 🌤️ Météo & Conditions Extérieures ────────────
        ("air_temp",            "air_temp",            "°C",  SensorDeviceClass.TEMPERATURE, "mdi:thermometer-lines", None),
        ("uv_index",            "uv_index",            "UV",  None,                          "mdi:sun-wireless", None),

        # ── 5. 📜 Moyennes & Calculs Chimie ──────────────────
        ("lsi",             "lsi",             None,    None,                          "mdi:water-percent", None),
        ("lsi_status",      "lsi_status",      None,    None,                          "mdi:water-check", None),
        ("ph_equilibre",    "ph_equilibre",    "pH",    None,                          "mdi:water-opacity", None),
        ("free_chlorine",   "free_chlorine",   "mg/L",  None,                          "mdi:water-check", None),
        ("active_chlorine", "active_chlorine", "mg/L",  None,                          "mdi:chemical-weapon", None),
        ("dose_ph_minus",   "dose_ph_minus",   "g",     None,                          "mdi:minus-circle-outline", None),
        ("dose_ph_plus",    "dose_ph_plus",    "g",     None,                          "mdi:plus-circle-outline", None),
        ("dose_tac_plus",   "dose_tac_plus",   "g",     None,                          "mdi:plus-box-outline", None),
        ("dose_cl_maint",   "dose_cl_maint",   "g",     None,                          "mdi:water-plus", None),
        ("dose_cl_shock",   "dose_cl_shock",   "g",     None,                          "mdi:flash", None),
        ("pump_hours",      "pump_hours",      "h",     None,                          "mdi:pump", None),
        ("conseil_filtration", "conseil_filtration", None,  None,                          "mdi:information-outline", None),
        ("pool_volume",     "pool_volume",     "L",     None,                          "mdi:pool", EntityCategory.DIAGNOSTIC),
    ]

    entities = [DomolinkPoolFullSensor(coordinator, pool_id, *config) for config in sensors_config]
    async_add_entities(entities)

class DomolinkPoolFullSensor(CoordinatorEntity, SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, coordinator: DataUpdateCoordinator, pool_id: str, translation_key: str, data_key: str, unit: str | None, device_class: SensorDeviceClass | None, icon: str, category: EntityCategory | None) -> None:
        super().__init__(coordinator)
        self._pool_id = pool_id
        self._attr_translation_key = translation_key
        self._data_key = data_key
        self._attr_native_unit_of_measurement = unit
        self._attr_device_class = device_class
        self._attr_icon = icon
        self._attr_entity_category = category
        self._attr_unique_id = f"domolink_pool_{pool_id}_{data_key}"

        if device_class != SensorDeviceClass.TIMESTAMP and unit is not None:
            self._attr_state_class = SensorStateClass.MEASUREMENT

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._pool_id)},
            name="DomoLink Pool Piscine",
            manufacturer="DomoLink",
            model="Pool Control Universel",
        )

    @property
    def native_value(self) -> Any:
        if not self.coordinator.data:
            return None
        val = self.coordinator.data.get(self._data_key)
        if val is None:
            return None
        if isinstance(val, float):
            return round(val, 2)
        return val
