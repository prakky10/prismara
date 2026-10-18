# Prismara: The Last Light

An original 3D creature adventure across 37 maps, with 40 creatures, six Keeper Trophies, five journal quests, and a story finale at Prism Summit.

Three.js renders the world, walking characters, creature models and biome battle arenas. Warm lighting, shadows, fog and a lighthouse title scene give the adventure depth. Phaser handles gameplay and the interface. A browser with WebGL support is required.

## Play locally

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Open http://127.0.0.1:5175 in Chrome. Saves stay in that browser and origin: use the same host and port to continue. The title menu offers the autosave and three manual slots.

| Action | Controls |
| --- | --- |
| Move / navigate | Arrow keys or WASD |
| Talk / confirm | Z or Enter |
| Back | X or Escape |
| Pause | C or Tab |
| Run | Shift |
| Journal tabs | Left / right, or click a tab |

Choose a partner, head north from Emberleaf, and follow the objective in the HUD and Field Journal. Clear Team Eclipse from Whisperwood before challenging Ivy; secure Voltspire's power supply before Volta. Healing Centers restore your team. Shops sell capture gear and supplies.

## Keeper Trophies

| Trophy | Keeper | Place | Field ability |
| --- | --- | --- | --- |
| Verdant | Ivy | Thistlebrook | Cut |
| Storm | Volta | Voltspire | Magnet |
| Tide | Marin | Tidehaven | Surf |
| Ember | Blaze | Ashfall | Light |
| Facet | Opal | Geode Hollow | Smash |
| Twilight | Raven | Duskmoor | Night Sight |

Each Trophy carries a keeper's memory. View the cabinet in **Journal & Trophies**. The journal also tracks quests with claimable rewards and a region atlas. After the six Trials, stop the Eclipse ritual and challenge Aurelia.

## Capture gear

Weaken wild creatures or inflict status conditions to improve capture odds. Every throw costs one ball, including failed throws. Trainer creatures cannot be captured.

| Ball | Specialty |
| --- | --- |
| Prism Orb | Standard capture |
| Great Prism | 1.5× bonus |
| Ultra Prism | 2× bonus |
| Dusk Orb | 3× at night or in caves |
| Luxe Orb | 2×, plus friendship |
| Tide Orb | 3× against Water |
| Bloom Orb | 3× against Grass |
| Quick Orb | 4× on the first turn |
| Timer Orb | Improves over time, up to 4× |
| Nest Orb | 3× against creatures at level 15 or below |
| Master Prism | Guaranteed capture of a living wild creature; finale reward |

## Development checks

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

`BUILD_LOG.md` records worker models and review rounds. `QA_NOTES.md` records acceptance coverage. Original sources are retained under `artifacts/baseline`; isolated worker handoffs and the integration candidate live under `artifacts/`.
