"""Run the whole MNIST test set through the simulated machine.

Cross-checks every mechanical prediction against exact integer arithmetic
(the machine and the regressor must agree perfectly - the simulation is
quasi-static, so any disagreement is an assembly bug), then reports test
accuracy and the moving-parts inventory.

Run:  python -m mnist_mech.evaluate
"""

import json
import time

import numpy as np

from .data import binarize, load_mnist, pool_4x4
from .machine import Machine


def evaluate(weights_path="weights/weights.json", data_dir="data",
             batch_size=2000):
    with open(weights_path) as f:
        spec = json.load(f)
    machine = Machine(spec["weights"], spec["bias"])

    _, _, test_images, test_labels = load_mnist(data_dir)
    cards = binarize(test_images)
    labels = test_labels.astype(np.int64)

    # arithmetic twin of the machine
    W = np.array(spec["weights"], dtype=np.int64)
    b = np.array(spec["bias"], dtype=np.int64)
    x = pool_4x4(cards).reshape(len(cards), 49)
    reference = np.argmax(x @ W.T + b, axis=1)

    predictions = np.empty(len(cards), dtype=np.int64)
    start = time.perf_counter()
    for lo in range(0, len(cards), batch_size):
        predictions[lo:lo + batch_size] = machine.run(cards[lo:lo + batch_size])
    elapsed = time.perf_counter() - start

    disagreements = int(np.sum(predictions != reference))
    accuracy = float(np.mean(predictions == labels))

    print(f"images simulated:            {len(cards)}")
    print(f"simulation time:             {elapsed:.2f} s "
          f"({len(cards) / elapsed:.0f} cards/s)")
    print(f"mechanical vs arithmetic:    {disagreements} disagreements")
    print(f"mechanical test accuracy:    {accuracy:.4f}")
    print()
    print("moving-parts inventory:")
    for stage, count in machine.parts_inventory().items():
        print(f"  {stage:24s} {count}")

    if disagreements:
        raise SystemExit("machine does not match its arithmetic twin")
    return accuracy


if __name__ == "__main__":
    evaluate()
