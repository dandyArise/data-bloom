<div align="center">

# DataBloom

### Transformez vos données en dashboards interactifs, simplement en les décrivant.

[![Quality](https://github.com/dandyArise/data-bloom/actions/workflows/quality.yml/badge.svg)](https://github.com/dandyArise/data-bloom/actions/workflows/quality.yml)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License: 0BSD](https://img.shields.io/badge/License-0BSD-green.svg)](LICENSE)

DataBloom est un AI Dashboard Builder local-first. Importez un dataset, demandez une analyse en langage naturel, puis acceptez, déplacez, redimensionnez ou supprimez les widgets proposés par l'assistant.

</div>

![Dashboard DataBloom avec KPI, bar chart et courbe](docs/screenshots/dashboard-charts.png)

## Ce que DataBloom sait faire

- **Construire par conversation** — l'assistant génère des propositions structurées à partir d'une consigne, avec validation avant ajout au canvas.
- **Importer des données réelles** — CSV, TSV, XLS, XLSX, XLSM et XLSB, mais aussi API HTTP et sources de monitoring HTTP, DNS ou ping.
- **Contrôler la qualité** — détection des doublons, valeurs manquantes, lignes vides et dates ambiguës avant l'analyse.
- **Profiler intelligemment** — distinction entre mesures, dimensions et identifiants numériques pour éviter les agrégations absurdes.
- **Composer librement** — déplacement, redimensionnement, suppression, inspection et édition de chaque widget.
- **Piloter par commandes** — tapez `/` dans le chat pour afficher le catalogue, puis utilisez par exemple `/pie`, `/heatmap` ou `/kpi-group`.
- **Présenter et exporter** — thème clair/sombre, mode présentation, aperçu JSON et génération de `workflow.yml`.

## Catalogue de widgets

Les widgets Bloom sont isolés du shell applicatif et partagent un contrat de données stable.

| Famille | Types disponibles |
|---|---|
| Indicateurs | `kpi`, `comparison`, `kpi-group` |
| Graphiques | `bar`, `line`, `pie`, `heatmap` |
| Données et contenu | `table`, `text`, `note` |
| Monitoring | `service-status`, `threshold-line`, `radial-gauge`, `availability-grid` |

Chaque rendu possède un état vide explicite. Les graphiques temporels affichent leurs axes, leur échelle et une hiérarchie visuelle cohérente ; les widgets de monitoring utilisent des couleurs fondées sur des seuils plutôt que sur le nom des champs.

![Contrôle de la qualité des données dans DataBloom](docs/screenshots/data-quality.png)

## Démarrage rapide

### Prérequis

- [Node.js 22+](https://nodejs.org/)
- [pnpm 11.9+](https://pnpm.io/)
- Facultatif : [LM Studio](https://lmstudio.ai/) pour utiliser l'assistant local

```powershell
git clone git@github.com:dandyArise/data-bloom.git
cd data-bloom
pnpm install
pnpm dev
```

Ouvrez ensuite [http://127.0.0.1:5173](http://127.0.0.1:5173). Un dataset financier prêt à importer est fourni dans [`examples/financial-sample.csv`](examples/financial-sample.csv).

## Connecter un modèle local

1. Lancez le serveur local de LM Studio sur le port `1234`.
2. Chargez explicitement le modèle que vous souhaitez utiliser.
3. Dans DataBloom, ouvrez **LLM** et conservez l'URL `/lmstudio/v1`.
4. Sélectionnez le modèle détecté, puis testez la connexion.

En développement, Vite relaie `/lmstudio` vers `http://127.0.0.1:1234`. DataBloom utilise les endpoints compatibles OpenAI `/models` et `/chat/completions`. La configuration reste dans le navigateur ; aucun service cloud n'est requis pour le mode local.

## Architecture

```text
src/
├── app/                     # orchestration, données, chat, état et shell UI
│   ├── components/          # vues et contrôles applicatifs
│   ├── hooks/               # contrôleur et état de l'espace de travail
│   ├── datasetImport.ts     # import et normalisation des datasets
│   ├── dataProfiling.ts     # profilage sémantique des champs
│   └── widgetDataAdapter.ts # adaptation Dataset → WidgetData
└── bloom/                   # bibliothèque visuelle autonome
    ├── registry.ts          # registre extensible des widgets
    ├── types.ts             # contrat public WidgetData / WidgetConfig
    ├── tokens.css           # design tokens clair et sombre
    ├── widgets/             # un module par type de widget
    └── dev/                 # harness de rendu isolé
```

Le shell importe Bloom uniquement via `@bloom/index`. Les composants visuels ne connaissent ni le chat, ni les datasets applicatifs, ni le stockage : l'adaptateur traduit les données métier vers le contrat public de Bloom. Les règles ESLint empêchent les dépendances inverses.

Pour ajouter un widget, créez son module sous `src/bloom/widgets/`, enregistrez-le dans le registre Bloom, puis ajoutez son adaptateur côté `src/app/`. La commande slash correspondante est générée automatiquement depuis le registre.

## Commandes utiles

```powershell
pnpm dev               # serveur de développement
pnpm check:boundaries  # architecture et lint strict
pnpm build             # TypeScript + build de production
pnpm preview           # prévisualisation du build
```

Le harness autonome des widgets est accessible en développement sur `/src/bloom/dev/harness.html`.

## Sécurité de la chaîne de dépendances

Le workspace pnpm impose un délai minimal avant l'installation des nouvelles versions publiées et bloque les rétrogradations de confiance. Ces protections réduisent l'exposition aux paquets compromis fraîchement publiés. Les clés d'API éventuelles doivent rester locales et ne doivent jamais être ajoutées au dépôt.

## Contribution

Les issues et pull requests sont les bienvenues. Avant de proposer un changement, exécutez au minimum :

```powershell
pnpm check:boundaries
pnpm build
```

## Licence

DataBloom est distribué sous licence [0BSD](LICENSE) : utilisation, modification et redistribution sans restriction, dans les limites précisées par la licence.

<div align="center">

Créé par [dandyArise](https://github.com/dandyArise).

</div>
