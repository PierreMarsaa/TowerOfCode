"""
Grader for Code-Life "challenge" exercises (write-the-code questions).

Shared by the game (loaded into Pyodide by the worker) and by
scripts/check-grading.py (run with local Python for QA). Pure stdlib.

Rule: run the starter, the solution and the player's code, each in a fresh
namespace, then check only what the learner was actually told:
  - named   : variables the starter uses or the question shows in `backticks`
              -> must exist with an equal value
  - hinted  : plain words of the question / starter comments ("total")
              -> that name OR any player variable may hold the value
                 (skipped for non-distinctive values: bools, None, -1/0/1, empty)
  - calls   : the solution's own calls to functions it defines, re-run in both
              namespaces, return values compared (when the arguments only use
              literals and named variables)
A named variable the solution sets to a plain literal the task never states
("store your age in `age`" -> age = 25) is the learner's choice: only its kind
(number / text / bool...) is checked.
Everything else (helpers, loop variables, free names) is ignored. Values that
differ between two runs of the solution (random, clocks) are never checked.

Entry point: toc_grade(config_json, lang, code, overrides_json) -> JSON string
  {"status": "pass" | "fail" | "error" | "self" | "internal",
   "problems": [{"kind": "missing" | "wrong" | "type" | "call", "name": str}],
   "stdout": str, "error": str | null, "checks": [str]}
"self" = nothing checkable: the challenge stays self-assessed ("Done").
"internal" = the grader itself failed (never the learner's fault).
"""

import ast
import builtins
import contextlib
import io
import json
import keyword
import math
import re
import tokenize
import traceback
import types

_IDENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_TICKS = re.compile(r"`+([^`]+?)`+")
_FILENAME = "<code>"
_MAX_CALL_CHECKS = 8


# ── Content helpers ──

def _loc(value, lang):
    """Resolve a plain string or an {"en", "fr"} dict"""
    if isinstance(value, dict):
        other = "fr" if lang == "en" else "en"
        return value.get(lang) or value.get(other) or ""
    return value if isinstance(value, str) else ""


def _strings(node, lang, out):
    """Every human-readable string in a block tree (question text, info cards...)"""
    if isinstance(node, dict):
        if set(node) <= {"en", "fr"} and node:
            out.append(_loc(node, lang))
            return
        for key, val in node.items():
            if key in ("type", "language", "cardType", "id"):
                continue
            _strings(val, lang, out)
    elif isinstance(node, list):
        for item in node:
            _strings(item, lang, out)
    elif isinstance(node, str):
        out.append(node)


def _solution_code(config, lang):
    for block in config.get("content", {}).get("solution", []) or []:
        if isinstance(block, dict) and block.get("type") == "codeBlock":
            return _loc(block.get("value"), lang)
    return ""


# ── Running code ──

def _run(code):
    """Execute in a fresh namespace. Returns (namespace, stdout, exception or None)."""
    ns = {"__name__": "__main__", "__builtins__": builtins}
    out = io.StringIO()
    try:
        compiled = compile(code, _FILENAME, "exec")
    except (SyntaxError, ValueError) as e:
        return ns, "", e
    err = None
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
        try:
            exec(compiled, ns)
        except (Exception, SystemExit) as e:  # timeouts/interrupts (BaseException) propagate
            err = e
    return ns, out.getvalue(), err


def _describe_error(e):
    """'Line 3: NameError: name 'x' is not defined' — only the player's own lines"""
    if isinstance(e, SyntaxError):
        where = f"Line {e.lineno}: " if e.lineno else ""
        return f"{where}{type(e).__name__}: {e.msg}"
    line = None
    for frame in traceback.extract_tb(e.__traceback__):
        if frame.filename == _FILENAME:
            line = frame.lineno
    where = f"Line {line}: " if line else ""
    return f"{where}{type(e).__name__}: {e}"


# ── Comparing values ──

def _is_user_obj(v):
    return type(v).__module__ == "__main__" and not isinstance(v, type)


def _checkable(v):
    """Values we can meaningfully compare across two separate runs"""
    if isinstance(v, (types.ModuleType, types.FunctionType, types.BuiltinFunctionType, types.MethodType, type)):
        return False
    if _is_user_obj(v):
        return True
    return type(v).__eq__ is not object.__eq__  # identity-only objects (files, generators) are out


def _eq(a, b, depth=0):
    if depth > 30:
        return False
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if isinstance(a, float) or isinstance(b, float):
            return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
        return a == b
    if isinstance(a, (types.FunctionType, type)) and isinstance(b, (types.FunctionType, type)):
        return True  # functions and classes only need to exist
    if type(a) is not type(b):
        # Classes defined by two different runs are different objects: compare by name + attributes
        if _is_user_obj(a) and _is_user_obj(b) and type(a).__name__ == type(b).__name__:
            return _eq_attrs(a, b, depth)
        return False
    if isinstance(a, (list, tuple)):
        return len(a) == len(b) and all(_eq(x, y, depth + 1) for x, y in zip(a, b))
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(_eq(a[k], b[k], depth + 1) for k in a)
    if isinstance(a, (set, frozenset)):
        return a == b
    if _is_user_obj(a):
        return _eq_attrs(a, b, depth)
    try:
        return bool(a == b)
    except Exception:
        return False


def _eq_attrs(a, b, depth):
    """Instances of user classes: same attributes (objects with __slots__ have no __dict__)"""
    da, db = getattr(a, "__dict__", None), getattr(b, "__dict__", None)
    if da is None or db is None:
        try:
            return bool(a == b)
        except Exception:
            return False
    return _eq(da, db, depth + 1)


def _same_kind(a, b):
    """For values the learner chooses: same kind of value (int and float are both numbers)"""
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b)
    if isinstance(b, (int, float)):
        return isinstance(a, (int, float))
    return type(a) is type(b)


def _distinctive(v):
    """Worth matching by value alone (a stray 0 or True proves nothing)"""
    if v is None or isinstance(v, bool):
        return False
    if isinstance(v, int) and abs(v) <= 1:
        return False
    if isinstance(v, (str, list, tuple, dict, set, frozenset)) and len(v) == 0:
        return False
    return True


# ── What the learner was told ──

def _identifiers(src):
    """(identifiers used in code, words in comments) — tolerant of broken starters"""
    code_ids, comment_words = set(), set()
    try:
        for tok in tokenize.generate_tokens(io.StringIO(src).readline):
            if tok.type == tokenize.NAME:
                code_ids.add(tok.string)
            elif tok.type == tokenize.COMMENT:
                comment_words |= set(_IDENT.findall(tok.string))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        for line in src.splitlines():
            code, _, comment = line.partition("#")
            code_ids |= set(_IDENT.findall(code))
            comment_words |= set(_IDENT.findall(comment))
    return code_ids - set(keyword.kwlist), comment_words


def _loop_variables(tree):
    """Names bound by module-level for loops (not inside functions/classes)"""
    names = set()

    def visit(stmts):
        for st in stmts:
            if isinstance(st, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                continue
            if isinstance(st, (ast.For, ast.AsyncFor)):
                names.update(n.id for n in ast.walk(st.target) if isinstance(n, ast.Name))
            for field in ("body", "orelse", "finalbody"):
                visit(getattr(st, field, None) or [])
            for handler in getattr(st, "handlers", None) or []:
                visit(handler.body)

    visit(tree.body)
    return names


class _ModuleCalls(ast.NodeVisitor):
    """Calls made at module level (not inside function, class or lambda bodies)"""

    def __init__(self):
        self.calls = []

    def visit_FunctionDef(self, node):
        pass

    visit_AsyncFunctionDef = visit_FunctionDef
    visit_ClassDef = visit_FunctionDef
    visit_Lambda = visit_FunctionDef

    def visit_Call(self, node):
        self.calls.append(node)
        self.generic_visit(node)


def _call_checks(tree, defined, allowed_names):
    """The solution's own module-level calls to functions/classes it defines,
    when their arguments only use literals, builtins and names the learner knows"""
    finder = _ModuleCalls()
    finder.visit(tree)
    allowed = allowed_names | set(dir(builtins)) | defined
    calls, seen = [], set()
    for node in finder.calls:
        if not (isinstance(node.func, ast.Name) and node.func.id in defined):
            continue
        used = {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}
        if not used <= allowed:
            continue
        src = ast.unparse(node)
        if src not in seen:
            seen.add(src)
            calls.append((node.func.id, src))
    return calls[:_MAX_CALL_CHECKS]


def _eval_call(ns, src):
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        return eval(compile(src, "<check>", "eval"), ns)


def _uses_random(tree):
    """Imports the random module (two reference runs can't reliably expose small random ranges)"""
    for node in ast.walk(tree):
        if isinstance(node, ast.Import) and any(alias.name.split(".")[0] == "random" for alias in node.names):
            return True
        if isinstance(node, ast.ImportFrom) and (node.module or "").split(".")[0] == "random":
            return True
    return False


_COMPUTED = object()


def _literal(node):
    """The constant a plain `name = <literal>` assigns, or _COMPUTED"""
    if isinstance(node, ast.Constant) and isinstance(node.value, (str, int, float, bool)):
        return node.value
    if (isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub)
            and isinstance(node.operand, ast.Constant)
            and isinstance(node.operand.value, (int, float)) and not isinstance(node.operand.value, bool)):
        return -node.operand.value
    return _COMPUTED


def _last_literals(tree):
    """name -> what its last module-level assignment sets it to (a literal, or _COMPUTED)"""
    last = {}

    def visit(stmts):
        for st in stmts:
            if isinstance(st, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                continue
            if isinstance(st, ast.Assign):
                for target in st.targets:
                    if isinstance(target, ast.Name):
                        last[target.id] = _literal(st.value)
            elif isinstance(st, ast.AnnAssign) and isinstance(st.target, ast.Name):
                last[st.target.id] = _literal(st.value) if st.value is not None else _COMPUTED
            elif isinstance(st, ast.AugAssign) and isinstance(st.target, ast.Name):
                last[st.target.id] = _COMPUTED
            for field in ("body", "orelse", "finalbody"):
                visit(getattr(st, field, None) or [])
            for handler in getattr(st, "handlers", None) or []:
                visit(handler.body)

    visit(tree.body)
    return last


def _stated(value, text):
    """Does the task text state this literal? (then it's required, not the learner's choice)"""
    if isinstance(value, bool):
        return str(value) in text
    if isinstance(value, str):
        v = value.strip().lower()
        return bool(v) and v in text.lower()
    forms = {repr(value), str(value)}
    if isinstance(value, float):
        if value.is_integer():
            forms.add(str(int(value)))
        forms |= {f.replace(".", ",") for f in list(forms)}  # French decimal comma
    return any(re.search(r"(?<![\d.,])" + re.escape(f) + r"(?!\d)", text) for f in forms)


# ── Entry point ──

def toc_grade(config_json, lang, code, overrides_json="{}"):
    try:
        return _grade(config_json, lang, code, overrides_json)
    except Exception as e:  # a grader bug must never look like the learner's mistake
        return json.dumps({"status": "internal", "problems": [], "stdout": "",
                           "error": f"{type(e).__name__}: {e}", "checks": []})


def _grade(config_json, lang, code, overrides_json):
    config = json.loads(config_json)
    overrides = json.loads(overrides_json or "{}")
    content = config.get("content", {})
    starter = _loc((content.get("exercise") or {}).get("value"), lang)
    solution = _solution_code(config, lang)
    question_parts = []
    for block in content.get("question", []) or []:
        if isinstance(block, dict) and block.get("type") in ("codeBlock", "codeEditorRun"):
            # Code shown in the question names things as clearly as `backticks`
            question_parts.append("`" + _loc(block.get("value"), lang).replace("`", "") + "`")
        else:
            _strings(block, lang, question_parts)
    question = "\n".join(question_parts)

    result = {"status": "self", "problems": [], "stdout": "", "error": None, "checks": []}

    def finish_with_player(status):
        p_ns, p_out, p_err = _run(code)
        result["stdout"] = p_out
        result["error"] = _describe_error(p_err) if p_err else None
        result["status"] = status
        return json.dumps(result)

    if overrides.get("mode") == "self" or not solution:
        return finish_with_player("self")

    # What the solution produces (twice: anything that differs between runs is unpredictable)
    s0, _, _ = _run(starter)
    s1, _, e1 = _run(solution)
    s2, _, e2 = _run(solution)
    if e1 or e2:
        return finish_with_player("self")  # broken or interactive solution

    try:
        tree = ast.parse(solution)
    except SyntaxError:
        return finish_with_player("self")
    if _uses_random(tree):
        return finish_with_player("self")  # random results can't be predicted by the learner

    starter_ids, comment_words = _identifiers(starter)
    backticked = set()
    for span in _TICKS.findall(question):
        backticked |= set(_IDENT.findall(span))
    # Single letters in prose are articles/pronouns ("a", "I", "y"), never variable names
    plain_words = {w for w in _IDENT.findall(_TICKS.sub(" ", question)) if len(w) > 1}
    named = starter_ids | backticked
    hinted = (plain_words | comment_words) - named
    loops = _loop_variables(tree)
    ignored = set(overrides.get("ignore", []))

    # A literal the task never states is the learner's choice ("your age" -> age = 25)
    literals = _last_literals(tree)
    task_text = question + "\n" + starter

    def free_choice(name, value):
        lit = literals.get(name, _COMPUTED)
        return lit is not _COMPUTED and _eq(value, lit) and not _stated(lit, task_text)

    named_targets, kind_targets, hinted_targets = [], [], []
    for name, value in s1.items():
        if name.startswith("__") or name in ignored:
            continue
        if not _checkable(value) or name not in s2 or not _eq(value, s2[name]):
            continue
        if name in s0 and _eq(s0[name], value):
            continue  # untouched starter variable
        if name in named:
            (kind_targets if free_choice(name, value) else named_targets).append(name)
        elif name in hinted and name not in loops and _distinctive(value) and not free_choice(name, value):
            hinted_targets.append(name)

    # Calls are evaluated on two extra runs: they may mutate their arguments,
    # and s1 must stay the expected end state for the variable checks
    defined = {n.name for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
    candidates = [c for c in _call_checks(tree, defined, named - loops) if c[0] not in ignored]
    calls = []
    if candidates:
        c1, _, ce1 = _run(solution)
        c2, _, ce2 = _run(solution)
        for func, src in candidates if not (ce1 or ce2) else []:
            try:
                v1, v2 = _eval_call(c1, src), _eval_call(c2, src)
            except Exception:
                continue
            if v1 is None or not _checkable(v1) or not _eq(v1, v2):
                continue
            # A call the starter already answers right (e.g. the class is given) proves nothing
            try:
                if _eq(_eval_call(s0, src), v1):
                    continue
            except Exception:
                pass
            calls.append((func, src, v1))

    result["checks"] = named_targets + [f"{n} (kind)" for n in kind_targets] + hinted_targets + [src for _, src, _ in calls]
    if not result["checks"]:
        return finish_with_player("self")

    # The player's run
    p_ns, p_out, p_err = _run(code)
    result["stdout"] = p_out
    if p_err:
        result["error"] = _describe_error(p_err)
        result["status"] = "error"
        return json.dumps(result)

    problems = []
    for name in named_targets:
        if name not in p_ns:
            problems.append({"kind": "missing", "name": name})
        elif not _eq(p_ns[name], s1[name]):
            problems.append({"kind": "wrong", "name": name})
    for name in kind_targets:
        if name not in p_ns:
            problems.append({"kind": "missing", "name": name})
        elif not _same_kind(p_ns[name], s1[name]):
            problems.append({"kind": "type", "name": name})
    player_values = [v for k, v in p_ns.items() if not k.startswith("__") and _checkable(v)]
    for name in hinted_targets:
        expected = s1[name]
        if name in p_ns and _eq(p_ns[name], expected):
            continue
        if any(_eq(v, expected) for v in player_values):
            continue
        problems.append({"kind": "wrong", "name": name})
    for func, src, expected in calls:
        if func not in p_ns:
            problems.append({"kind": "missing", "name": func})
            continue
        try:
            got = _eval_call(p_ns, src)
        except (Exception, SystemExit):
            problems.append({"kind": "call", "name": src})
            continue
        if not _eq(got, expected):
            problems.append({"kind": "call", "name": src})

    # One message per name is enough
    unique, seen = [], set()
    for p in problems:
        if p["name"] not in seen:
            seen.add(p["name"])
            unique.append(p)
    result["problems"] = unique
    result["status"] = "fail" if unique else "pass"
    return json.dumps(result)
