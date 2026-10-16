#!/usr/bin/env python3
"""
QA for the code-challenge grader (src/python/grader.py, the same file the game
runs in Pyodide), using local Python.

For every Python "challenge" exercise, in EN and in FR:
  - auto-checked ones: the solution must pass, the untouched starter must not
  - the rest are self-checked ("Done"), listed with the reason
Then runs scripts/grading-fixtures.json: hand-written alternative right answers
must pass, near-misses must fail.

  python3 scripts/check-grading.py           report only
  python3 scripts/check-grading.py --write   also write src/data/curriculum/python/grading.json
                                             (code fights prefer auto-checked challenges)

Exercise code runs in a temporary directory with an empty stdin and a 10 s limit.
"""

import io
import json
import os
import signal
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURRICULUM = ROOT / "src/data/curriculum/python"
OVERRIDES = CURRICULUM / "grading-overrides.json"
FIXTURES = ROOT / "scripts/grading-fixtures.json"
LANGS = ("en", "fr")

grader = {"__name__": "grader"}
exec(compile((ROOT / "src/python/grader.py").read_text(encoding="utf-8"), "grader.py", "exec"), grader)


class Timeout(BaseException):
    pass


def _on_alarm(signum, frame):
    raise Timeout()


def grade(config, lang, code, overrides):
    signal.signal(signal.SIGALRM, _on_alarm)
    signal.alarm(10)
    try:
        return json.loads(grader["toc_grade"](json.dumps(config), lang, code, json.dumps(overrides)))
    except Timeout:
        return {"status": "timeout", "problems": []}
    finally:
        signal.alarm(0)


def load_challenges():
    challenges = []
    for path in sorted((CURRICULUM / "exercises").glob("*.json")):
        for ex in json.loads(path.read_text(encoding="utf-8")):
            if ex.get("type") == "challenge":
                challenges.append(ex)
    return challenges


def main():
    write = "--write" in sys.argv
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}
    challenges = load_challenges()
    by_id = {c["id"]: c for c in challenges}

    workdir = tempfile.mkdtemp(prefix="toc-grading-")
    os.chdir(workdir)            # exercises that write files write here
    sys.stdin = io.StringIO("")  # input() raises EOFError instead of waiting

    grading, bad, self_reasons = {}, [], {}
    for ex in challenges:
        ov = overrides.get(ex["id"], {})
        statuses = []
        for lang in LANGS:
            solution = grader["_solution_code"](ex, lang)
            starter = grader["_loc"](ex["content"]["exercise"]["value"], lang)
            r = grade(ex, lang, solution, ov)
            if r["status"] == "pass":
                s = grade(ex, lang, starter, ov)
                if s["status"] == "pass":
                    bad.append(f"{ex['id']} [{lang}] the untouched starter passes (checks: {r['checks']})")
                statuses.append("auto")
            elif r["status"] == "self":
                statuses.append("self")
                self_reasons[ex["id"]] = "override" if ov.get("mode") == "self" else "nothing checkable / solution can't run"
            else:
                bad.append(f"{ex['id']} [{lang}] its own solution gets '{r['status']}': {r.get('problems') or r.get('error')}")
                statuses.append("bad")
        grading[ex["id"]] = "auto" if all(st == "auto" for st in statuses) else "self"

    auto = sum(1 for v in grading.values() if v == "auto")
    print(f"Challenges: {len(challenges)}   auto-checked: {auto} ({auto * 100 // len(challenges)}%)   self-checked: {len(challenges) - auto}")
    mixed = [i for i in grading if grading[i] == "self" and i not in self_reasons]
    if mixed:
        print(f"Auto in one language only (kept self-checked): {', '.join(mixed)}")

    # Fixtures: alternative right answers and near-misses
    fixture_failures = []
    fixtures = json.loads(FIXTURES.read_text(encoding="utf-8")) if FIXTURES.exists() else []
    for fx in fixtures:
        ex = by_id.get(fx["id"])
        if not ex:
            fixture_failures.append(f"{fx['id']}: exercise not found")
            continue
        r = grade(ex, fx.get("lang", "en"), fx["code"], overrides.get(fx["id"], {}))
        ok = r["status"] == "pass" if fx["expect"] == "pass" else r["status"] in ("fail", "error")
        if fx["expect"] == "self":
            ok = r["status"] == "self"
        if not ok:
            fixture_failures.append(f"{fx['id']} [{fx.get('lang', 'en')}] {fx.get('note', '')}: expected {fx['expect']}, got {r['status']} {r.get('problems') or r.get('error') or ''}")
    print(f"Fixtures: {len(fixtures) - len(fixture_failures)}/{len(fixtures)} as expected")

    for line in bad:
        print("  ✗", line)
    for line in fixture_failures:
        print("  ✗ fixture", line)

    if write:
        out = CURRICULUM / "grading.json"
        out.write_text(json.dumps(dict(sorted(grading.items())), indent=2) + "\n", encoding="utf-8")
        print(f"Written {out.relative_to(ROOT)}")

    sys.exit(1 if bad or fixture_failures else 0)


if __name__ == "__main__":
    main()
