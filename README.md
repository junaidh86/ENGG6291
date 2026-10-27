# Physics-guided tool-wear review prototype

A static capstone research prototype for reviewing NASA milling runs, curated flank wear (VB), and held-out classification predictions. The app combines current-signal features, healthy-load references and machining history. It runs entirely in the browser, without a backend or login.

**Research prototype, not a machine-control or validated deployment system. Displayed scores use curated targets, including adjusted and estimated VB; they are not independent measured-only accuracy.**

## Open the app

Open `index.html` locally, or enable GitHub Pages. No installation is needed to use the committed page. Raw-file upload, arbitrary live training and new-input inference are not included.

## Publish with GitHub Pages

1. Create a GitHub repository, for example `nasa-tool-wear-prototype`.
2. Upload the contents of this folder so `index.html` is at the repository root. Include `.nojekyll` and the documentation/source folders.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**, then **main** and **/ (root)**. Save.
5. Open the site URL supplied by GitHub after deployment completes.

The package is prepared locally; it has not created a repository or published anything. GitHub's current instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## What the app shows

- **NASA runs:** material, available AC/DC signals and model selection; curated VB and its provenance; original measurements; predicted classes; probabilities; confusion matrices and CSV download.
- **VB boundary exercise:** two numeric boundaries and three visible class ranges. Nine declared boundary pairs have separately fitted classifiers and precomputed whole-case predictions. Unsupported boundary values retain the previous valid results.
- **Paper comparison:** fixed published Table 7 current-sensor accuracies versus our original-boundary ridge-LR fusion, with different targets/protocols disclosed. Missing paper F1/AUC/matrices are not invented.
- Layout rules adapt cards and controls for smaller screens; wide record tables scroll independently.

## Evaluation policy

Training uses `VB_curated`. The displayed scores also use `VB_curated`, including isotonic adjustments, interpolation and extrapolation. Original VB is preserved, and original-measurement-only results remain in the source payload for traceability. A changed score after switching targets does not establish a prediction improvement.

Whole-case exclusion happens before reference fitting, scaling and model training. Healthy calibration remains based on original measured VB <0.15 mm in usable training runs, even during the class-boundary exercise. Each material is modelled separately. The near-silent recording is excluded from sensor models but retained in the records.

The routes were explored repeatedly on NASA; results are exploratory. Class probabilities are not independently calibrated confidence. The published paper's full 152-feature/RF/subset-search implementation has not been reproduced in this app.

## Defaults: scoring against curated VB

| Material and route | Correct / curated targets | Accuracy |
|---|---:|---:|
| Cast iron, history + settings / RF | 97 / 109 | 88.99% |
| Cast iron, AC + DC + history / ridge LR | 90 / 108 | 83.33% |
| J45 steel, AC + DC + history / ridge LR | 53 / 58 | 91.38% |

These are default 0.15/0.30 mm classifications. They differ from the earlier measured-only evaluations of 87/98, 82/98 and 44/48, respectively.

## Build and check

To edit the site, change `src/template.html`, `src/app.js`, `src/paper.js`, or `src/engine.js`. The source payload is `src/data.json`.

With Node.js installed:

```sh
node scripts/build.cjs
node tests/verify.cjs
```

No npm dependencies are required. The test checks the generated page, 1,065 inference vectors, curated scoring and all nine threshold scenarios using a simulated DOM. This package does not contain the full raw-data model-training environment; it reproduces the static review app from frozen results. Live browser visual inspection was blocked in the preparation environment and is not claimed.

## Data, attribution and licensing

See [DATA_AND_METHODS.md](DATA_AND_METHODS.md), [CREDITS.md](CREDITS.md) and [LICENSING.md](LICENSING.md). No raw NASA recordings or publisher PDF are bundled. The page and `src/data.json` do include NASA-derived scalar records, original measured VB, curated labels, model parameters and predictions; these are public when you publish the site. No private project files, authentication secrets, analytics, remote fonts or tracking scripts are included.

A code license has not been chosen for you. Add your selected LICENSE before describing this project as open source.
