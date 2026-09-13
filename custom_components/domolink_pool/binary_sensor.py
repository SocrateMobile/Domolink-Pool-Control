import logging
from homeassistant.components.binary_sensor import (
    BinarySensorEntity,
    BinarySensorDeviceClass,
)
from homeassistant.helpers.update_coordinator import CoordinatorEntity, DataUpdateCoordinator
from homeassistant.helpers.entity import DeviceInfo, EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    pool_id = entry.entry_id
    entities = [
        DomolinkPoolProblemBinarySensor(coordinator, pool_id, "ph_simple", "ph_status"),
        DomolinkPoolProblemBinarySensor(coordinator, pool_id, "chlorine_simple", "chlorine_status"),
    ]
    async_add_entities(entities)

class DomolinkPoolProblemBinarySensor(CoordinatorEntity, BinarySensorEntity):
    _attr_has_entity_name = True
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, coordinator: DataUpdateCoordinator, pool_id: str, data_key: str, translation_key: str) -> None:
        super().__init__(coordinator)
        self._pool_id = pool_id
        self._data_key = data_key
        self._attr_translation_key = translation_key
        self._attr_unique_id = f"domolink_pool_{pool_id}_{translation_key}"

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._pool_id)},
            name="DomoLink Pool Piscine",
            manufacturer="DomoLink",
            model="Pool Control Universel",
        )

    @property
    def is_on(self) -> bool | None:
        if not self.coordinator.data:
            return None
        st = self.coordinator.data.get(self._data_key)
        if st is None:
            return None
        return st not in ("OK", "Excellent")
