"""Unit tests for the mechanical components and the assembled machine.

Run:  python -m unittest discover tests
"""

import unittest

import numpy as np

from mnist_mech.data import pool_4x4
from mnist_mech.machine import Machine


def random_machine_spec(rng):
    weights = rng.integers(-2, 3, size=(10, 49))
    bias = rng.integers(-30, 31, size=10)
    return weights, bias


class TestPooling(unittest.TestCase):
    def test_pool_counts_each_block(self):
        card = np.zeros((1, 28, 28), dtype=np.uint8)
        card[0, 0:4, 0:4] = 1          # block (0,0) full: 16
        card[0, 4, 4] = 1              # block (1,1): 1
        card[0, 24:28, 24:26] = 1      # block (6,6): 8
        pooled = pool_4x4(card)[0]
        self.assertEqual(pooled[0, 0], 16)
        self.assertEqual(pooled[1, 1], 1)
        self.assertEqual(pooled[6, 6], 8)
        self.assertEqual(pooled.sum(), 25)

    def test_pool_range(self):
        rng = np.random.default_rng(1)
        cards = rng.integers(0, 2, size=(50, 28, 28))
        pooled = pool_4x4(cards)
        self.assertTrue((pooled >= 0).all() and (pooled <= 16).all())


class TestMachine(unittest.TestCase):
    def test_matches_arithmetic_twin(self):
        rng = np.random.default_rng(2)
        weights, bias = random_machine_spec(rng)
        machine = Machine(weights, bias)
        cards = rng.integers(0, 2, size=(200, 28, 28))
        predictions = machine.run(cards)
        x = pool_4x4(cards).reshape(len(cards), 49)
        reference = np.argmax(x @ weights.T + bias, axis=1)
        np.testing.assert_array_equal(predictions, reference)

    def test_rod_heights_match_scores_up_to_lift(self):
        rng = np.random.default_rng(3)
        weights, bias = random_machine_spec(rng)
        machine = Machine(weights, bias)
        cards = rng.integers(0, 2, size=(20, 28, 28))
        machine.run(cards)
        x = pool_4x4(cards).reshape(len(cards), 49)
        scores = x @ weights.T + bias
        np.testing.assert_array_equal(machine.scores() - machine.lift, scores)

    def test_rods_never_pass_travel_stop(self):
        # all weights maximally negative, worst-case all-holes card
        weights = np.full((10, 49), -2)
        bias = np.full(10, -30)
        machine = Machine(weights, bias)
        machine.run(np.ones((1, 28, 28), dtype=np.uint8))
        self.assertTrue((machine.scores() >= 0).all())

    def test_tie_goes_to_lowest_digit(self):
        # identical rods -> identical heights -> bar registers digit 0
        weights = np.tile(np.arange(49) % 3 - 1, (10, 1))
        bias = np.zeros(10, dtype=np.int64)
        machine = Machine(weights, bias)
        rng = np.random.default_rng(4)
        predictions = machine.run(rng.integers(0, 2, size=(5, 28, 28)))
        self.assertTrue((predictions == 0).all())

    def test_zero_weights_have_no_parts(self):
        weights = np.zeros((10, 49), dtype=np.int64)
        weights[3, 7] = 2
        weights[5, 0] = -1
        machine = Machine(weights, np.zeros(10, dtype=np.int64))
        self.assertEqual(machine.parts_inventory()["coupler pulleys"], 3)

    def test_rejects_nonbinary_cards(self):
        machine = Machine(np.zeros((10, 49)), np.zeros(10))
        with self.assertRaises(AssertionError):
            machine.run(np.full((1, 28, 28), 2))


if __name__ == "__main__":
    unittest.main()
