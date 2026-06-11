# Mechanical MNIST Classifier

A simulated **mechanical computer** that classifies handwritten digits.
A 28×28 *binary* MNIST image is a punched card; the machine pools each
4×4 block into a 7×7 image of hole counts (0–16), pushes those counts
through a **quantized logistic regressor built from cords, pulleys and
levers** (weights restricted to −2, −1, 0, +1, +2), and reads the
prediction off the tallest of ten score rods.

```
punched card ──> feeler pins ──> pooling columns ──> weighted cords ──> score rods ──> falling bar
 28×28 holes      784 pins        49 followers        ≤490 lacings       10 rods        argmax
                 (0/1 each)       (height 0..16)      (ratio ±1, ±2)    (height=score)  (readout)
```

## Results

| model | test accuracy |
|---|---|
| float logistic regressor on pooled 7×7 counts | 88.98% |
| quantized {−2..+2} regressor = the machine | **87.53%** |

The simulated machine agrees with exact integer arithmetic on **all
10,000 test cards** and pushes them through at ~130,000 cards/s — and
training prunes half the weights to zero, so 245 of the 490 possible
couplers are never built.

## Design: minimal moving parts, reasonable compute

Two decisions shape everything here.

**1. Quasi-static simulation, not dynamics.** Every part has a single
degree of freedom and the machine is strictly feed-forward, so each
card's outcome is the unique equilibrium reached by propagating
displacements once through the parts in assembly order. No time
stepping, no contact solver — and the propagation is batched, so
thousands of cards run through the simulated machine at once. This is
what makes the 10,000-card test set take seconds instead of days.

**2. Choose mechanisms where arithmetic is geometry.**

* *Pooling by stacking* — each 4×4 block's 16 feeler pins drop through
  holes and slide into a common channel where they pile up; a follower
  rod rides the pile, so its height **is** the hole count. Addition
  with one moving part beyond the pins themselves (no gear trains,
  no carry mechanisms — the pooled value 0–16 never needs digits).
* *Multiplication by lacing* — a weight of magnitude 1 is a cord from
  the pooling follower to a digit's score rod; magnitude 2 is the same
  cord around a 2:1 movable pulley; the sign is which side of the rod
  the cord pulls. The coarse weight grid {−2..2} is not a compromise,
  it is the point: these are the only ratios cords realise cheaply,
  and **a zero weight is a part that doesn't exist** (training
  charges a "parts tax" so unneeded couplers are pruned away).
* *Bias for free* — each rod's bias is its rest cord length, set at
  assembly: zero moving parts. A machine-wide lift (uniform, so the
  comparison is unaffected) keeps every rod above its travel stop.
* *Argmax by gravity* — a bar lowered over the ten rods settles on the
  tallest; the contact names the digit (leftmost contact wins ties,
  matching `numpy.argmax`).

## Components that had to be built along the way

Endeavours like this need more than the headline mechanism. The pieces
that turned out to be missing, in build order:

1. **Card press** (`data.py`) — MNIST download, binarization at gray
   level 128, and the exact arithmetic twin of the pooling stage used
   for cross-checking.
2. **A trainer that respects the machine** (`train.py`) — float warm
   start → grid-scale search → **exact coordinate descent on the
   integer grid**. Gradient straight-through tricks lost ~10% accuracy
   here; with only 490 weights × 5 levels it is cheaper to try every
   level of every weight and keep the one with the fewest training
   errors (cross-entropy only breaks ties, and the parts tax prices
   each pulley at a few training samples).
3. **The part library** (`components.py`) — `PixelPin`,
   `PoolingColumn`, `WeightedCoupler`, `ScoreRod`, `ArgmaxBar`; each
   knows how many moving pieces it contributes.
4. **The assembly jig** (`machine.py`) — builds the machine from
   `weights.json`, computes the safety lift from the worst-case card,
   and keeps the moving-parts inventory.
5. **The acceptance rig** (`evaluate.py`, `tests/`) — every mechanical
   prediction is checked against exact integer arithmetic; any
   disagreement is an assembly bug, not noise.

## Moving-parts inventory

| stage | parts |
|---|---|
| feeler pins | 784 |
| pooling followers | 49 |
| coupler pulleys (= Σ\|w\|, pruned by training) | 342 |
| score rods + return springs | 20 |
| falling bar | 1 |
| **total** | **1,196** |

(`python -m mnist_mech.evaluate` reprints this inventory for whatever
weights are loaded.)

## Usage

```bash
pip install numpy

python -m mnist_mech.train      # trains, writes weights/weights.json (~5 min)
python -m mnist_mech.evaluate   # full test set through the machine
python -m mnist_mech.demo 7     # watch one card go through, stage by stage
python -m unittest discover tests
```

A trained `weights/weights.json` is checked in, so `evaluate` and
`demo` work without retraining.
