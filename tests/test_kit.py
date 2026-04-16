import unittest

from scripts.lib import kit


class SmokeTest(unittest.TestCase):
    def test_module_imports(self):
        self.assertTrue(hasattr(kit, "PLACEHOLDER_RE"))


if __name__ == "__main__":
    unittest.main()
