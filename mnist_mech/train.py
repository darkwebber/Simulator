"""Train the quantized logistic regressor whose weights drive the machine.

The mechanical inference stage computes, per class k:

    score_k = sum_j  w_kj * x_j  +  b_k        (then argmax over k)

where x_j are the 49 pooled pixel counts (0..16), w_kj must lie in
{-2, -1, 0, +1, +2} (cord-and-pulley couplers can only realise those
ratios, and a zero weight means the part is simply omitted), and b_k is
any small integer (a static frame offset, so it costs no moving part).

Training recipe:
  1. float warm start  - ordinary softmax regression on the pooled counts
  2. scale search      - find the grid scale s so that clip(round(W/s), -2, 2)
                         loses the least validation accuracy
  3. coordinate descent - the model is tiny (490 weights x 5 levels), so
                         instead of straight-through gradient tricks we sweep
                         every weight and try all 5 levels exactly, keeping
                         the level with the fewest training errors (cross-
                         entropy only breaks ties).  A small per-unit-
                         magnitude charge (the "parts tax") pulls weights to
                         zero so moving parts disappear.

Run:  python -m mnist_mech.train
Writes: weights/weights.json
"""

import json
import os

import numpy as np

from .data import features, load_mnist

NUM_CLASSES = 10
NUM_FEATURES = 49
WEIGHT_LEVELS = np.array([-2, -1, 0, 1, 2], dtype=np.float64)
TEMPERATURE = 32.0  # softens integer-scale logits; argmax is unaffected
RNG_SEED = 0


def _softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def _accuracy(W, b, X, y):
    return float(np.mean(np.argmax(X @ W.T + b, axis=1) == y))


def _train_float(X, y, Xval, yval, W, b, *, epochs, lr, batch_size=256,
                 rng=None):
    """Plain mini-batch softmax regression warm start."""
    rng = rng or np.random.default_rng(RNG_SEED)
    onehot = np.eye(NUM_CLASSES)[y]
    vW, vb = np.zeros_like(W), np.zeros_like(b)
    momentum = 0.9
    best = (-1.0, W.copy(), b.copy())
    n = len(X)
    for epoch in range(epochs):
        order = rng.permutation(n)
        step_lr = lr * 0.5 ** (epoch / max(epochs - 1, 1) * 3)
        for start in range(0, n, batch_size):
            idx = order[start:start + batch_size]
            Xb, yb = X[idx], onehot[idx]
            p = _softmax((Xb @ W.T + b) / TEMPERATURE)
            g = (p - yb) / len(idx)
            vW = momentum * vW - step_lr * (g.T @ Xb) / TEMPERATURE
            vb = momentum * vb - step_lr * g.sum(axis=0) / TEMPERATURE
            W = W + vW
            b = b + vb
        acc = _accuracy(W, b, Xval, yval)
        if acc > best[0]:
            best = (acc, W.copy(), b.copy())
        print(f"  [float] epoch {epoch + 1:2d}/{epochs}  val acc {acc:.4f}")
    return best[1], best[2]


def _search_scale(W, b, Xval, yval):
    """Pick the grid scale that quantizes with the least accuracy loss."""
    best = (-1.0, 1.0)
    for s in np.geomspace(np.abs(W).max() / 8, np.abs(W).max(), 60):
        Wq = np.clip(np.rint(W / s), WEIGHT_LEVELS[0], WEIGHT_LEVELS[-1])
        acc = _accuracy(Wq, np.rint(b / s), Xval, yval)
        if acc > best[0]:
            best = (acc, s)
    return best[1]


def _coordinate_descent(X, y, Xval, yval, Wq, bq, *, parts_tax, sweeps=12):
    """Exact discrete optimization on the weight grid.

    Maintains logits Z = X @ Wq.T + bq incrementally; for each weight tries
    all 5 levels and keeps the one with the fewest *training errors* - at
    this grid coarseness cross-entropy and accuracy disagree, and accuracy
    is what the machine is judged on, so CE only breaks ties.  `parts_tax`
    is the error-rate price charged per unit of weight magnitude: it prices
    each pulley/cord so couplers that pay for themselves with only a few
    training samples fall away.
    """
    n = len(X)
    Z = (X @ Wq.T + bq).astype(np.float64)
    rows = np.arange(n)
    # CE tie-break weight: a full-scale CE change must be worth less than
    # one training sample
    ce_weight = 0.5 / (n * 10.0)

    def objective(Zk, k):
        """Error rate (+ tiny CE) when logit column k is replaced by Zk."""
        Zc = Z.copy()
        Zc[:, k] = Zk
        err = float(np.mean(Zc.argmax(axis=1) != y))
        m = Zc.max(axis=1)
        s = np.exp((Zc - m[:, None]) / TEMPERATURE).sum(axis=1)
        ce = float(np.mean(np.log(s) - (Zc[rows, y] - m) / TEMPERATURE))
        return err + ce_weight * ce

    best = (_accuracy(Wq, bq, Xval, yval), Wq.copy(), bq.copy())
    for sweep in range(sweeps):
        changed = 0
        for k in range(NUM_CLASSES):
            # weights of class k
            for j in range(NUM_FEATURES):
                current = Wq[k, j]
                base = Z[:, k] - current * X[:, j]
                best_level = current
                best_loss = objective(Z[:, k], k) + parts_tax * abs(current)
                for level in WEIGHT_LEVELS:
                    if level == current:
                        continue
                    loss = objective(base + level * X[:, j], k) \
                        + parts_tax * abs(level)
                    if loss < best_loss - 1e-12:
                        best_loss, best_level = loss, level
                if best_level != current:
                    Wq[k, j] = best_level
                    Z[:, k] = base + best_level * X[:, j]
                    changed += 1
            # bias of class k (free: it is a frame offset, not a moving part)
            for delta in (-8, -4, -2, -1, 1, 2, 4, 8):
                if objective(Z[:, k] + delta, k) \
                        < objective(Z[:, k], k) - 1e-12:
                    bq[k] += delta
                    Z[:, k] += delta
                    changed += 1
        acc = _accuracy(Wq, bq, Xval, yval)
        nz = int(np.count_nonzero(Wq))
        print(f"  [cd] sweep {sweep + 1}/{sweeps}  changed {changed:3d}  "
              f"val acc {acc:.4f}  nonzero {nz}/490")
        if acc > best[0]:
            best = (acc, Wq.copy(), bq.copy())
        if changed == 0:
            break
    return best[1], best[2]


def train(data_dir="data", out_path="weights/weights.json", parts_tax=5e-5):
    train_images, train_labels, test_images, test_labels = load_mnist(data_dir)
    X = features(train_images).astype(np.float64)
    Xtest = features(test_images).astype(np.float64)
    y, ytest = train_labels.astype(np.int64), test_labels.astype(np.int64)

    # hold out the tail of the training set for validation
    Xtr, ytr = X[:55000], y[:55000]
    Xval, yval = X[55000:], y[55000:]

    rng = np.random.default_rng(RNG_SEED)
    W = rng.normal(0, 0.01, (NUM_CLASSES, NUM_FEATURES))
    b = np.zeros(NUM_CLASSES)

    print("phase 1: float warm start")
    W, b = _train_float(Xtr, ytr, Xval, yval, W, b, epochs=20, lr=8.0, rng=rng)
    float_test_acc = _accuracy(W, b, Xtest, ytest)
    print(f"float test accuracy: {float_test_acc:.4f}")

    print("phase 2: grid scale search")
    s = _search_scale(W, b, Xval, yval)
    Wq = np.clip(np.rint(W / s), WEIGHT_LEVELS[0], WEIGHT_LEVELS[-1])
    bq = np.rint(b / s)
    print(f"  scale {s:.4f}, rounded val acc {_accuracy(Wq, bq, Xval, yval):.4f}")

    print("phase 3: coordinate descent on the integer grid")
    Wq, bq = _coordinate_descent(Xtr, ytr, Xval, yval, Wq, bq,
                                 parts_tax=parts_tax)

    Wq = Wq.astype(np.int64)
    bq = bq.astype(np.int64)
    quant_test_acc = _accuracy(Wq, bq, Xtest, ytest)
    nonzero = int(np.count_nonzero(Wq))
    print(f"quantized test accuracy: {quant_test_acc:.4f}")
    print(f"nonzero weights (moving couplers needed): {nonzero}/490")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({
            "description": "quantized logistic regressor for the mechanical "
                           "MNIST machine; weights[k][j] couples pooled "
                           "pixel j (row-major 7x7) to digit rod k",
            "weight_levels": [-2, -1, 0, 1, 2],
            "weights": Wq.tolist(),
            "bias": bq.tolist(),
            "binarize_threshold": 128,
            "float_test_accuracy": float_test_acc,
            "quantized_test_accuracy": quant_test_acc,
            "nonzero_weights": nonzero,
        }, f, indent=1)
    print(f"wrote {out_path}")
    return Wq, bq


if __name__ == "__main__":
    train()
