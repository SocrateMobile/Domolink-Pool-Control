# DomoLink Pool Control

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)
[![Validate](https://github.com/SocrateMobile/Domolink-Pool-Control/actions/workflows/validate.yml/badge.svg)](https://github.com/SocrateMobile/Domolink-Pool-Control/actions)

Intégration et tableau de bord complet pour le suivi et la gestion intelligente de votre piscine dans Home Assistant.

## Fonctionnalités

- 💧 **Suivi en temps réel** : pH, potentiel Redox (ORP), température de l'eau, conductivité, température de l'air et indice UV.
- 🧪 **Calculs & Traitement chimique** :
  - Indice de Saturation de Langelier (LSI / ISL) pour évaluer le pouvoir incrustant ou corrosif de l'eau.
  - Calcul automatique des doses recommandées de produits de traitement (pH+, pH-, Chlore régulier, Chlore choc, TAC+).
- 🔌 **Contrôle et calcul de filtration** : Calcul de la durée journalière de filtration recommandée basée sur la température de l'eau et pilotage de la pompe.
- 📊 **Tableau de bord dédié** : Panel Lovelace interactif intégré dans Home Assistant.

## Prérequis

- Home Assistant 2024.1.0 ou supérieur.
- Des entités de capteurs existantes dans Home Assistant (ex. sondes pH, température, chlore/ORP via Zigbee, MQTT, ESPHome ou toute autre intégration).

## Installation

### Installation via HACS (recommandé)

1. Ouvrez **HACS** dans votre instance Home Assistant.
2. Cliquez sur les **3 points** en haut à droite > **Dépôts personnalisés**.
3. Ajoutez l'URL `https://github.com/SocrateMobile/Domolink-Pool-Control` avec la catégorie **Intégration**.
4. Recherchez **DomoLink Pool Control** et cliquez sur **Télécharger**.
5. Redémarrez Home Assistant.

### Installation manuelle

1. Téléchargez la dernière version depuis la page [Releases](https://github.com/SocrateMobile/Domolink-Pool-Control/releases).
2. Copiez le dossier `custom_components/domolink_pool` dans votre répertoire `config/custom_components/`.
3. Redémarrez Home Assistant.

## Configuration

1. Rendez-vous dans **Paramètres** > **Appareils et services** > **Ajouter une intégration**.
2. Recherchez **DomoLink Pool Control**.
3. Suivez l'assistant de configuration pour sélectionner les capteurs de votre bassin (volume de la piscine, sondes pH, température, ORP, etc.).
4. Personnalisez les seuils chimiques et le comportement de filtration dans les options de l'intégration à tout moment.

## Entités créées

- `sensor.domolink_pool_ph` : pH de l'eau
- `sensor.domolink_pool_temperature` : Température de l'eau
- `sensor.domolink_pool_orp` : Potentiel Redox (ORP en mV)
- `sensor.domolink_pool_lsi` : Indice de saturation de Langelier
- `sensor.domolink_pool_filtration_recommended_hours` : Heures de filtration recommandées
- `sensor.domolink_pool_treatment_*` : Doses de traitement recommandées

## Licence

Ce projet est sous licence MIT.
