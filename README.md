# DomoLink Pool Control

Contrôlez et surveillez la chimie de votre piscine de manière centralisée, **sans capteur propriétaire**.
DomoLink Pool Control remplace la logique Cloud (Flipr, etc.) par les capteurs locaux (Zigbee, Tuya, Wi-Fi) de votre choix ! 

## 🌟 Fonctionnalités Principales
- **Support Universel** : Associez vos entités existantes (pH, Température, ORP/Redox, Température Air, UV) issues d'autres intégrations.
- **Calculs de Chimie Avancés** : Équilibre de l'eau (Indice de Langelier), recommandations de temps de filtration, conseils de dosage (pH Minus, Chlore Choc, etc.).
- **Interface Graphique "Glassmorphism"** : Le magnifique Dashboard natif de la suite DomoLink, sans aucune dépendance logicielle.
- **Synergie Écosystème** :
  - Sauvegardes de sécurité S3 via *DomoLink-BackUp* avant les mises à jour (OTA).
  - Redémarrage sécurisé via *Restart-HA*.
  - Entité native de mise à jour.

## 🛠️ Installation
1. Ajoutez ce dépôt dans **HACS** (Dépôts personnalisés).
2. Téléchargez **DomoLink Pool Control**.
3. Redémarrez Home Assistant.
4. Allez dans *Paramètres > Appareils et services > Ajouter une intégration*.
5. Cherchez **DomoLink Pool Control**.
6. Renseignez vos capteurs locaux dans le formulaire (Capteur pH, Température Eau, etc.).

## ⚙️ Configuration
Via le bouton **Configurer** de l'intégration, vous pouvez ajuster les paramètres de chimie (Volume de la piscine, TAC, TH, CYA, TDS) pour des calculs sur mesure.
