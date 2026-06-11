"""MNIST loading and the arithmetic reference for the machine's front end.

The physical machine receives a 28x28 *binary* image (a punched card: hole or
no hole).  Its first stage pools each 4x4 block by counting holes, giving a
7x7 image with values 0..16.  This module provides the same operations in
plain numpy so the mechanical simulator can be cross-checked against exact
arithmetic.
"""

import gzip
import os
import struct
import urllib.request

import numpy as np

MIRRORS = [
    "https://storage.googleapis.com/cvdf-datasets/mnist/",
    "https://ossci-datasets.s3.amazonaws.com/mnist/",
]

FILES = {
    "train_images": "train-images-idx3-ubyte.gz",
    "train_labels": "train-labels-idx1-ubyte.gz",
    "test_images": "t10k-images-idx3-ubyte.gz",
    "test_labels": "t10k-labels-idx1-ubyte.gz",
}

BINARIZE_THRESHOLD = 128  # gray level at or above this punches a hole


def _download(filename, data_dir):
    path = os.path.join(data_dir, filename)
    if os.path.exists(path):
        return path
    os.makedirs(data_dir, exist_ok=True)
    last_err = None
    for mirror in MIRRORS:
        try:
            urllib.request.urlretrieve(mirror + filename, path)
            return path
        except OSError as err:
            last_err = err
    raise RuntimeError(f"could not download {filename}: {last_err}")


def _read_idx(path):
    with gzip.open(path, "rb") as f:
        magic = struct.unpack(">I", f.read(4))[0]
        ndim = magic & 0xFF
        shape = struct.unpack(f">{ndim}I", f.read(4 * ndim))
        return np.frombuffer(f.read(), dtype=np.uint8).reshape(shape)


def load_mnist(data_dir="data"):
    """Return (train_images, train_labels, test_images, test_labels).

    Images are uint8 arrays of shape (N, 28, 28).
    """
    arrays = {}
    for key, filename in FILES.items():
        arrays[key] = _read_idx(_download(filename, data_dir))
    return (arrays["train_images"], arrays["train_labels"],
            arrays["test_images"], arrays["test_labels"])


def binarize(images):
    """Grayscale (N, 28, 28) -> binary (N, 28, 28) punched-card pattern."""
    return (images >= BINARIZE_THRESHOLD).astype(np.uint8)


def pool_4x4(binary_images):
    """Count holes in each 4x4 block: (N, 28, 28) -> (N, 7, 7) ints in 0..16.

    This is the arithmetic twin of the machine's spacer-stack pooling stage.
    """
    n = binary_images.shape[0]
    blocks = binary_images.reshape(n, 7, 4, 7, 4)
    return blocks.sum(axis=(2, 4)).astype(np.int64)


def features(images):
    """Grayscale images -> flat (N, 49) pooled integer features."""
    return pool_4x4(binarize(images)).reshape(len(images), 49)
