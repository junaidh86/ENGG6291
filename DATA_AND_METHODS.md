# Data and methods

## Source

NASA PCoE Milling Wear, supplied by UC Berkeley's BEST Lab. Official catalogue: https://catalog.data.gov/dataset/milling-wear . The catalogue identifies public access and links its license field to https://www.usa.gov/government-works . This is the dataset-specific catalogue information, not a blanket claim about every file hosted by NASA.

The package contains derived scalar records and precomputed results. It excludes mill.mat, mill.zip and raw sensor time series. Curated VB is a project-derived target, not an original NASA measurement.

## Scope

16 tool-life cases, 167 runs, 146 original measured VB labels; cast iron and J45 steel. One near-silent run is excluded from sensor routes. The current app reviews AC/DC/history predictions; AE/vibration and cross-dataset MU/KSF inference are future work.

AC uses central-window RMS and the CV of twenty one-second block RMS values. DC uses central-window mean; DC-only routes additionally use sample CV. Fusion inputs are CNALR, AC CV, log(1+recorded time), log(1+time*feed*DOC), and normalized DC mean. Healthy normalization is a physics-guided empirical reference, not a first-principles wear law. Time*feed*DOC is an exposure proxy, not calibrated removed volume.

## Class boundaries and scoring

Default: Fresh VB<0.15; Worn 0.15<=VB<0.30; Failed VB>=0.30 mm. Failed denotes a high-wear category, not necessarily fracture. Exercise boundaries: first=0.10,0.15,0.20; second=0.25,0.30,0.35 mm.

Curated targets preserve original measurements separately. Within-case isotonic adjustment, interpolation and boundary extrapolation supply reviewed targets. Displayed evaluation includes derived estimates; they do not add independent measurements. Sensor-route curated evaluation uses 108 cast-iron and 58 steel runs, metadata-only uses 109 and 58. Whole-case predictions remain held out from training; curation is retrospective within each tool life.

References/scalers are training-only and fixed for each fold. The exercise recomputes classifier fits for all nine declared pairs while keeping measured-Fresh healthy eligibility below the original 0.15 mm. This isolates the label-boundary exercise rather than fitting a new calibration policy.

## Published comparison

Abubakr et al. Table 7 current-sensor accuracies are 95.5% cast iron and 96.6% steel. Their randomized segmented-data evaluation differs from our whole-case curated-target evaluation. Matching material-specific F1, AUC and confusion matrices are unavailable. The app makes no matched superiority claim and does not substitute a partial Python adaptation for the original published pipeline.

## Frozen results

This package is a static review build. Precomputed scenarios update without a server. It does not retrain models when a visitor changes a control, and does not support arbitrary thresholds outside the nine declared pairs. Source payload and tests are included; full model-training reproduction requires the separate scientific project and original dataset.
