"""Push one punched card through the machine and show what every stage did.

Run:  python -m mnist_mech.demo [index]
"""

import sys

import numpy as np

from .data import binarize, load_mnist, pool_4x4
from .machine import Machine

SHADES = " .:-=+*#%@"  # 0..16 mapped onto 10 shades


def main(index=0):
    machine = Machine.from_weights_file()
    _, _, test_images, test_labels = load_mnist()
    card = binarize(test_images[index:index + 1])

    prediction = machine.run(card)[0]
    heights = machine.scores()[0]
    pooled = pool_4x4(card)[0]

    print(f"test card #{index}   true digit: {test_labels[index]}")
    print("\npunched card (28x28):")
    for row in card[0]:
        print("  " + "".join("#" if v else "." for v in row))

    print("\npooling follower heights (7x7, 0..16):")
    for row in pooled:
        print("  " + " ".join(f"{v:2d}" for v in row)
              + "   " + "".join(SHADES[min(v * 9 // 16, 9)] * 2 for v in row))

    print("\nscore rod heights (* marks where the falling bar settled):")
    top = heights.max()
    for digit, h in enumerate(heights):
        bar = "#" * int(round(40 * h / top)) if top else ""
        mark = " *" if digit == prediction else ""
        print(f"  digit {digit}: {h:5d} {bar}{mark}")

    print(f"\nmachine says: {prediction}   "
          f"({'correct' if prediction == test_labels[index] else 'wrong'})")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
