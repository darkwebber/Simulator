"""Assembly of the full mechanical MNIST classifier from trained weights."""

import json
from collections import OrderedDict

import numpy as np

from .components import (ArgmaxBar, PixelPin, PoolingColumn, ScoreRod,
                         WeightedCoupler)


class Machine:
    """The assembled machine: card reader -> pooling -> cords -> readout."""

    def __init__(self, weights, bias):
        weights = np.asarray(weights, dtype=np.int64)  # (10, 49)
        bias = np.asarray(bias, dtype=np.int64)        # (10,)
        assert weights.shape == (10, 49)
        assert np.all(np.abs(weights) <= 2)
        self.weights = weights
        self.bias = bias

        # card reader: one feeler pin per pixel
        self.pins = [[PixelPin(r, c) for c in range(28)] for r in range(28)]

        # pooling stage: one column per 4x4 block, row-major over the 7x7 grid
        self.columns = []
        for br in range(7):
            for bc in range(7):
                block_pins = [self.pins[br * 4 + dr][bc * 4 + dc]
                              for dr in range(4) for dc in range(4)]
                self.columns.append(PoolingColumn(block_pins))

        # the machine-wide lift keeps every rod above its travel stop even
        # at the worst case (all negative-laced columns at full height 16);
        # it is uniform across rods so the argmax comparison is unchanged
        worst_drop = max(
            16 * int(-weights[k][weights[k] < 0].sum()) - int(bias[k])
            for k in range(10))
        self.lift = max(worst_drop, 0)

        # inference stage: cords from columns to ten score rods
        self.couplers = []
        self.rods = []
        for k in range(10):
            rod_couplers = []
            for j in range(49):
                if weights[k, j] != 0:
                    coupler = WeightedCoupler(self.columns[j],
                                              int(weights[k, j]))
                    rod_couplers.append(coupler)
                    self.couplers.append(coupler)
            self.rods.append(ScoreRod(k, rod_couplers, int(bias[k]),
                                      self.lift))

        self.bar = ArgmaxBar(self.rods)

        # feed-forward propagation order = assembly order
        self._order = ([pin for row in self.pins for pin in row]
                       + self.columns + self.couplers + self.rods
                       + [self.bar])

    @classmethod
    def from_weights_file(cls, path="weights/weights.json"):
        with open(path) as f:
            spec = json.load(f)
        return cls(spec["weights"], spec["bias"])

    def run(self, cards):
        """Push a batch of punched cards through the machine.

        cards: (batch, 28, 28) binary array.
        Returns predicted digits, shape (batch,).
        """
        cards = np.asarray(cards)
        assert cards.ndim == 3 and cards.shape[1:] == (28, 28)
        assert set(np.unique(cards)) <= {0, 1}, "cards must be binary"
        for row in self.pins:
            for pin in row:
                pin.read_card(cards)
        for component in self._order:
            component.propagate()
        return self.bar.prediction

    def scores(self):
        """Rod heights after the last run (lift + bias + weighted sum)."""
        return np.stack([rod.displacement for rod in self.rods], axis=1)

    def parts_inventory(self):
        """Count of moving parts by stage."""
        inventory = OrderedDict()
        inventory["feeler pins"] = sum(p.moving_parts
                                       for row in self.pins for p in row)
        inventory["pooling followers"] = sum(c.moving_parts
                                             for c in self.columns)
        inventory["coupler pulleys"] = sum(c.moving_parts
                                           for c in self.couplers)
        inventory["score rods + springs"] = sum(r.moving_parts
                                                for r in self.rods)
        inventory["argmax bar"] = self.bar.moving_parts
        inventory["total"] = sum(inventory.values())
        return inventory
