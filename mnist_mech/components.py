"""Component library for the mechanical MNIST classifier.

These are the parts that turned out to be missing when designing the
machine, built here as a *quasi-static* simulation: every component has a
single degree of freedom (a displacement along its guide), and because the
machine is feed-forward - card, then pooling columns, then cords, then
score rods, then the falling bar - displacements can be propagated once,
in assembly order, instead of integrating any dynamics.  That choice is
what makes simulating the whole 10,000-image test set take seconds rather
than days.  Displacements are stored as numpy arrays over a batch axis, so
one propagation pass pushes a whole stack of punched cards through the
machine at once.

The four part types, and the physical trick each one uses:

* `PixelPin` - reads one card position.  The pin rests on the card and
  falls one unit where a hole is punched.
* `PoolingColumn` - mechanical 4x4 sum-pooling with no gear train: the
  block's 16 pins are arranged to slide sideways into a common vertical
  channel when they fall, where they pile up.  A follower rod rides the
  pile, so its height *is* the hole count (0..16).  Addition by stacking.
* `WeightedCoupler` + `ScoreRod` - the quantized multiply-accumulate.
  Each digit has a spring-loaded score rod hanging from a cord.  A nonzero
  weight is realised by lacing that cord around a pulley on the pooling
  follower: a direct lacing takes up one unit of cord per unit of follower
  travel (weight magnitude 1), a 2:1 movable-pulley lacing takes up two
  (magnitude 2), and lacing on the other side of the rod pays cord *out*
  instead (negative sign), letting the return spring drop the rod.  A zero
  weight is no lacing at all - the part simply does not exist.  The rod's
  rest height encodes the bias plus a machine-wide lift that keeps every
  rod's travel positive (uniform across rods, so the comparison below is
  unaffected).
* `ArgmaxBar` - the readout.  A horizontal bar is lowered over all ten
  rods and settles on the tallest one; the contact point names the digit.
  On a tie the bar is built to register the leftmost (lowest digit)
  contact, matching `numpy.argmax`.
"""

import numpy as np


class Component:
    """One rigid part (or small assembly) with a single degree of freedom."""

    #: number of individually moving pieces this component contributes
    moving_parts = 0

    def __init__(self):
        self.displacement = None  # (batch,) array after propagation

    def propagate(self):
        raise NotImplementedError


class PixelPin(Component):
    """Feeler pin over one card position; falls 1 unit through a hole."""

    moving_parts = 1

    def __init__(self, row, col):
        super().__init__()
        self.row = row
        self.col = col

    def read_card(self, cards):
        # cards: (batch, 28, 28) binary
        self.displacement = cards[:, self.row, self.col].astype(np.int64)

    def propagate(self):
        pass  # set by read_card


class PoolingColumn(Component):
    """4x4 sum pooling: fallen pins pile up in a channel under a follower.

    Follower height = number of fallen pins = hole count of the block.
    Moving parts: just the follower; the 16 pins are counted by PixelPin.
    """

    moving_parts = 1

    def __init__(self, pins):
        super().__init__()
        assert len(pins) == 16
        self.pins = pins

    def propagate(self):
        self.displacement = sum(pin.displacement for pin in self.pins)


class WeightedCoupler(Component):
    """Cord lacing from a pooling follower to a score rod.

    Cord take-up = weight * follower displacement.  Magnitude from the
    pulley ratio (1 or 2), sign from which side of the rod the cord pulls.
    Moving parts: one idler pulley, plus a movable pulley block for
    magnitude 2.
    """

    def __init__(self, column, weight):
        super().__init__()
        assert weight in (-2, -1, 1, 2), "zero weights must be omitted"
        self.column = column
        self.weight = weight
        self.moving_parts = abs(weight)

    def propagate(self):
        self.displacement = self.weight * self.column.displacement


class ScoreRod(Component):
    """Spring-loaded rod for one digit; height = rest_height + cord take-up.

    rest_height = machine lift + bias, both set at assembly time by cord
    length, so the bias costs no moving part.  Moving parts: rod + spring.
    """

    moving_parts = 2

    def __init__(self, digit, couplers, bias, lift):
        super().__init__()
        self.digit = digit
        self.couplers = couplers
        self.rest_height = lift + bias

    def propagate(self):
        total = sum(c.displacement for c in self.couplers) if self.couplers else 0
        self.displacement = self.rest_height + total


class ArgmaxBar(Component):
    """Bar lowered onto the score rods; settles on (and names) the tallest."""

    moving_parts = 1

    def __init__(self, rods):
        super().__init__()
        self.rods = rods
        self.prediction = None

    def propagate(self):
        heights = np.stack([rod.displacement for rod in self.rods], axis=1)
        if np.any(heights < 0):
            raise RuntimeError(
                "a score rod was driven below its travel stop; "
                "the machine lift is set too low")
        self.displacement = heights.max(axis=1)
        # leftmost contact wins ties, like numpy.argmax
        self.prediction = heights.argmax(axis=1)
