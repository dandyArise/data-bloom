# Guidelines de design — Databloom / Sales overview

Ce document accompagne `tokens.css`. Le fichier CSS donne les valeurs, ce
document donne les **règles** et le **pourquoi**, pour qu'un agent de code
(Codex ou autre) ne les redécouvre pas à chaque prompt.

**Règle n°1, au-dessus de toutes les autres : ne jamais écrire une couleur,
un espacement ou un rayon en dur. Toujours passer par une variable de
`tokens.css`.** Si une valeur manque, l'ajouter au fichier de tokens plutôt
que de l'inliner.

---

## 1. Couleur

- **Une couleur = une seule signification dans toute l'application.**
  `--seg-government` (bleu) ne veut dire "Government" nulle part ailleurs.
  Si un nouveau graphique a besoin de couleur, vérifier d'abord si la
  dimension affichée est déjà une palette existante (Segment) — sinon,
  utiliser une teinte unique dédiée (`--country-c`, `--line-c`, ou en créer
  une nouvelle et la documenter ici).
- **`--pos` / `--neg` sont réservés au sens financier ou de statut réel**
  (profit positif/négatif, succès/échec). Ne pas les utiliser pour de la
  simple décoration.
- **Pas de badge orange/rouge pour un état neutre ou positif.** "Accès
  complet", "Connecté", "Actif" → `--pos` ou neutre, jamais `--neg`.
  Réserver le rouge à un vrai problème.
- Contraste minimum : texte principal sur fond clair ≥ 4.5:1 (WCAG AA).
  `--ink` sur `--bg`/`--surface` passe large ; `--ink-soft` est la limite
  basse acceptable pour du texte secondaire, jamais pour du texte principal.

## 2. Typographie

- **IBM Plex Sans** pour tout texte d'interface (titres, labels, corps).
- **IBM Plex Mono** pour **tout chiffre affiché**, sans exception : KPI,
  cellules numériques de tableau, ticks d'axe, labels de valeur sur les
  graphiques. Le mélange sans/mono sur les nombres est ce qui fait "brouillon"
  visuellement — ne jamais l'oublier même sur un petit label d'axe.
- Respecter l'échelle définie (`--text-xs` → `--text-xl`). Ne pas inventer
  une taille intermédiaire pour "que ça rentre" — ajuster l'espace plutôt
  que la police.

## 3. Espacement & rayons

- Grille de 4px stricte (`--space-1` à `--space-10`). Toute valeur hors
  grille (13px, 17px, 22px…) est un bug à corriger, pas une exception.
- Rayons : `--radius-sm` pour chips/petits boutons, `--radius-md` pour
  inputs/boutons, `--radius-lg` pour cartes/panneaux. Ne pas mélanger.

## 4. Graphiques — règles non négociables

C'est la source la plus fréquente d'oublis, donc en détail :

1. **Type de graphique ↔ nature de la donnée.**
   - Donnée catégorielle (segment, pays, produit, discount band) → **barres**.
   - Série strictement chronologique (jour, mois, date) → **courbe**.
   - Une courbe entre "Canada, France, Germany, Mexico" est un contresens :
     ça suggère une progression entre pays qui n'existe pas. Si le doute
     existe sur un widget, se poser la question "est-ce que l'ordre de
     l'axe X a un sens de progression ?" — si non, barres.
2. **Toujours afficher la valeur.** Label au-dessus de chaque barre, label
   sur le dernier point d'une courbe. L'utilisateur ne doit jamais deviner
   une hauteur à l'œil.
3. **Axe avec grille légère + ticks au format compact** (`12k`, `1,2M`), et
   un **tooltip natif** (`<title>` en SVG) donnant la valeur exacte complète
   au survol.
4. **Jamais de troncature en "…" sur un label de catégorie.** Retour à la
   ligne sur 2 lignes maximum. Si le nom est trop long même sur 2 lignes,
   raccourcir proprement (ex. abréviation connue) plutôt que couper au
   milieu d'un mot ("Governme…").
5. **Une seule teinte par graphique**, sauf si la dimension affichée est
   une palette catégorielle déjà définie (Segment). Ne pas repeindre un
   graphique "Profit par pays" avec la palette de Segment : ça laisse
   croire à une correspondance de sens qui n'existe pas.

## 5. Tableaux de données

- Header collant (`position: sticky; top: 0`).
- Colonnes numériques : alignées à droite, police mono, chiffres tabulaires.
- Valeur manquante → `—` en `--muted`, en italique, jamais la même graisse
  que les vraies valeurs (sinon impossible de distinguer "vide" de "donnée").
- Éviter une ligne de filtre par colonne qui double la hauteur du header ;
  préférer une recherche globale ou un filtre en popover au clic.
- Ne pas afficher les 15+ pastilles de schéma en permanence au-dessus du
  tableau — les replier dans un disclosure ("16 champs ▾").

## 6. Chat / conversation

- **Pas de cadre complet autour de chaque tour de conversation.** Distinguer
  utilisateur/IA par l'alignement (droite/gauche) + fond teinté
  (`--user-bg` / `--surface-alt`), pas par une bordure systématique.
- **Un seul identifiant par message** (le nom "Vous"/"Databloom" OU
  l'avatar, jamais les deux répétés en double affichage).
- **Le markdown doit être parsé avant affichage** : `**gras**` → `<strong>`,
  les puces `•`/`-` → une vraie liste `<ul><li>`. Ne jamais laisser les
  astérisques bruts visibles à l'écran.
- **Un seul nom de produit/assistant dans toute l'app.** Si le header dit
  "Databloom", chaque réponse de l'IA doit être signée "Databloom" — pas
  un autre nom.
- **Les infos techniques de debug (port local, backend LLM, endpoint) ne
  vont jamais dans le header principal.** Un point de statut discret
  (pastille verte "Connecté") suffit ; le détail technique vit derrière
  une icône réglages.
- **Un seul en-tête de conversation.** Ne pas répéter le titre de la
  discussion sur 2-3 lignes différentes (sélecteur + champ éditable +
  compteur séparé) — une seule ligne : titre + compteur de messages.

## 7. États interactifs

- Hover : `--shadow-hover` sur les cartes, fond `#F7FAF9` sur les lignes de
  tableau, la couleur de bordure passe de `--border` à `--border-strong`
  sur les boutons/inputs.
- Focus (clavier) : toujours un anneau visible, `outline: 2px solid
  var(--accent)` — ne jamais désactiver le focus par défaut sans le
  remplacer.
- Sélection : anneau doux (`--shadow-focus`), jamais une bordure de couleur
  vive saturée qui "crie".

## 8. Thème sombre

- Chaque composant lit uniquement les noms de variables (`var(--accent)`,
  `var(--seg-government)`...), jamais une valeur hex en dur — sinon le bloc
  `[data-theme="dark"]` de `tokens.css` n'a aucun effet sur ce composant.
- Le fond sombre n'est jamais noir pur (`#000`). On garde un gris très
  foncé (`#111315`) pour conserver de la profondeur sur les élévations/ombres.
- Les couleurs sémantiques et catégorielles (segments, pos/neg, accent) ont
  chacune une valeur éclaircie dédiée en sombre — une couleur qui passe bien
  en clair peut devenir illisible ou terne sur fond sombre ; ne jamais
  réutiliser telle quelle la valeur claire.
- Le tooltip au survol reste sombre **dans les deux thèmes** — ce n'est pas
  soumis à `[data-theme]`, c'est une convention indépendante (un tooltip
  clair sur fond clair perd son contraste).

## 9. Presets de taille — en unités de grille, jamais en pixels

Un widget vit sur la grille invisible définie précédemment (coordonnées
`x, y, w, h` en cellules). La taille d'un widget est donc une question de
**combien de cellules il occupe**, pas une dimension pixel fixe — le rendu
interne (SVG/Canvas) doit toujours remplir son conteneur (`viewBox` +
`width:100%`), jamais une taille figée qui déborderait ou flotterait dans
sa cellule.

| Preset | Empreinte grille | Usage |
|---|---|---|
| `xs` | 3 colonnes × 2 lignes | KPI, statut, valeur unique |
| `sm` | 4 colonnes × 3 lignes | Graphique compact, peu de catégories |
| `md` | 6 colonnes × 4 lignes | Graphique standard (défaut) |
| `lg` | 9 colonnes × 6 lignes | Graphique détaillé, légende, plus de points |

Plus un widget est petit, moins il doit afficher d'éléments : à `xs`, pas
d'axe ni de légende, juste la forme et la valeur. À `lg`, on peut se
permettre légende, grille complète, labels sur chaque point. C'est la
densité d'information qui doit s'adapter à la taille, pas juste un
agrandissement proportionnel du même rendu.

## 10. Personnalisation par composant

Deux niveaux de surcharge, à ne pas confondre :

- **Niveau thème** (tout le produit) → on édite les tokens dans
  `tokens.css`, jamais une valeur locale dans un composant.
- **Niveau instance** (un utilisateur veut une couleur custom sur CE
  widget précis) → on redéfinit `--widget-accent` en style inline sur le
  conteneur du widget (`style="--widget-accent:#E85D9C"`), et le composant
  interne lit `var(--widget-accent, var(--accent))` avec fallback sur le
  token global. Jamais de couleur en dur dans le composant lui-même.

Pour les graphiques qui ont une logique de couleur complexe (catégorielle
pour Segment, à seuil pour une jauge de latence), privilégier une prop de
type callback plutôt qu'un mapping figé — `colorScheme={(item, index) =>
...}` plutôt qu'un objet de correspondance statique — pour que Codex (ou
l'utilisateur final) puisse injecter sa propre logique sans toucher au
composant.

## 11. Catalogue de widgets étendu

En plus des types déjà couverts (KPI, bar, line, pie, table) et des types
spécifiques au monitoring (statut, jauge à seuil, heatmap de disponibilité) :

| Widget | Cas d'usage typique |
|---|---|
| Waterfall (cascade) | Décomposer un total en contributions positives/négatives — ex. pont de profit (Sales → Discounts → COGS → Profit) |
| Marimekko | Croiser deux dimensions catégorielles avec largeur ET hauteur porteuses de sens — ex. Segment × Country |
| Bubble | Comparer 3 variables numériques à la fois (x, y, taille de bulle) |
| Sparkline | Mini-courbe compacte, utilisée en ligne de tableau pour une tendance rapide |
| Sankey | Flux entre étapes — utile pour un pipeline (visiteurs → leads → clients) |
| Bar List | Classement horizontal compact, alternative légère à un bar chart pour un top N |
| Radial (gauge/bar/scatter) | Variante circulaire d'un widget existant quand l'espace est carré plutôt que large |

## Checklist rapide avant de livrer un écran

- [ ] Aucune couleur/espacement/rayon en dur, tout vient de `tokens.css`
- [ ] Tous les chiffres affichés sont en police mono
- [ ] Chaque graphique catégoriel est en barres, chaque série temporelle en courbe
- [ ] Chaque barre/point affiche sa valeur + un tooltip au survol
- [ ] Aucun label n'est tronqué avec "…" au milieu d'un mot
- [ ] Une seule couleur = une seule signification, vérifié entre tous les widgets du dashboard
- [ ] Aucun markdown brut (`**`, `•`) visible à l'écran
- [ ] Un seul nom de produit / assistant utilisé partout
- [ ] Aucune info de debug (port, endpoint) dans le header principal
- [ ] Pas de cadre autour de chaque message de chat
- [ ] Le composant ne référence que des `var(--token)`, jamais un hex en dur — sinon le thème sombre ne s'applique pas
- [ ] La taille d'un widget est une empreinte de grille (`xs/sm/md/lg`), pas une dimension pixel figée
