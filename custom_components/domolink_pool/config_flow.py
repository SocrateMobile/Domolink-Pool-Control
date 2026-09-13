"""Config flow et Options flow pour DomoLink Pool Control."""
import logging
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from .const import (
    DOMAIN,
    CONF_TAC, CONF_TH, CONF_CYA, CONF_TDS,
    DEFAULT_TAC, DEFAULT_TH, DEFAULT_CYA, DEFAULT_TDS
)

_LOGGER = logging.getLogger(__name__)

class DomolinkPoolConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Gestion du formulaire de configuration pour DomoLink Pool Control."""
    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Étape 1 : Choix des entités capteurs."""
        errors = {}
        if user_input is not None:
            await self.async_set_unique_id("domolink_pool_" + user_input["ph_entity"])
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title="DomoLink Pool Control",
                data=user_input
            )

        data_schema = vol.Schema({
            vol.Required("ph_entity"): selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor")),
            vol.Required("water_temp_entity"): selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor")),
            vol.Optional("orp_entity"): selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor")),
            vol.Optional("air_temp_entity"): selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor")),
            vol.Optional("uv_entity"): selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor")),
        })

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
            description_placeholders={}
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return DomolinkPoolOptionsFlowHandler(config_entry)


class DomolinkPoolOptionsFlowHandler(config_entries.OptionsFlow):
    """Options de chimie de l'eau."""

    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        opt = self.config_entry.options
        schema = vol.Schema({
            vol.Optional(CONF_TAC, default=opt.get(CONF_TAC, DEFAULT_TAC)): int,
            vol.Optional(CONF_TH, default=opt.get(CONF_TH, DEFAULT_TH)): int,
            vol.Optional(CONF_CYA, default=opt.get(CONF_CYA, DEFAULT_CYA)): int,
            vol.Optional(CONF_TDS, default=opt.get(CONF_TDS, DEFAULT_TDS)): int,
            vol.Optional("pool_volume", default=opt.get("pool_volume", 40)): int,
        })
        return self.async_show_form(step_id="init", data_schema=schema)
