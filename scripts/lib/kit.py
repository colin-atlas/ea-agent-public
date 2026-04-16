"""Atlas Kit install primitives. Plan 2 fills this in task by task."""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

PLACEHOLDER_RE = re.compile(r"\[([A-Z][A-Z0-9_]*)\]")
