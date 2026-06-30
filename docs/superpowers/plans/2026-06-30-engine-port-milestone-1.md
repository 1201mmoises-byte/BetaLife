# BetaLife Engine Port — Milestone 1 (Seeder, Axes, Archetypes, Stamps, Names) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the dependency-free foundation of the BetaLife TS engine — `seeder.ts`, `axes.ts`, `archetypes.ts`, `stamps.ts`, `nameGenerator.ts` — into GDScript under `GodotGame`, bit-identical to the TS output for the same seed, proven by GdUnit4 tests including golden-value tests captured from the real TS engine. No scenes, no rendering.

**Architecture:** Each TS module becomes one GDScript file under `scripts/engine/`, exposing the same functions as `static func`s on a namespace class (e.g. `BLSeeder`, `BLAxes`). Shared data shapes use `Dictionary` (e.g. `SoulAxes`) where the TS type is a simple value bag, and small `RefCounted` inner classes where there's real behavior or strong reuse (e.g. `BLStamps.Stamp`, `BLArchetypes.OriginArchetype`). Determinism hinges entirely on `BLSeeder` replicating `mulberry32` + its FNV-1a string hash bit-for-bit, including a subtlety where the hash step uses plain (precision-lossy) float multiplication in the original TS, not `Math.imul` — see Task 3.

**Tech Stack:** Godot 4.7 (GDScript, standard build), GdUnit4 for testing, Node/ts-node (in the separate BetaLife repo) to generate golden vectors.

## Global Constraints

- Godot 4.7, GDScript (not C#/.NET) — per `CLAUDE.md`.
- `scripts/` and `tests/` layout, `test_<thing>.gd` naming, GdUnit4 — per `AGENTS.md`.
- Static typing preferred for non-trivial variables — per `AGENTS.md` code style.
- Source of truth for translated logic: `C:\Users\Noobi\OneDrive\Documents\MoisesGame\BetaLife-main\BetaLife-main\src\engine\{seeder,axes,archetypes,stamps,nameGenerator}.ts`.
- Every module in this plan must produce **bit-identical** output to its TS counterpart for the same seed — this is the acceptance bar for every task, not just a nice-to-have.
- No `.tscn` files, no `Node`-derived classes, no rendering in this plan — pure logic only.

---

### Task 1: Install GdUnit4 and verify the test runner

**Files:**
- Create: `addons/gdUnit4/` (via the `godot` skill's GdUnit4 installation flow)
- Modify: `project.godot` (register the plugin)
- Test: `tests/test_smoke.gd`

**Interfaces:**
- Produces: a working `gdUnit4` addon and a confirmed headless test-run command, reused by every later task in this plan.

- [ ] **Step 1: Install the GdUnit4 addon**

Invoke the project's `godot` skill (it explicitly covers "GdUnit4 testing" per `CLAUDE.md`) and follow its guidance to install GdUnit4 into `addons/gdUnit4/`. Do not hand-roll a `git clone` with a guessed version tag — let the skill pick a Godot-4.7-compatible version.

- [ ] **Step 2: Enable the plugin**

Confirm (or add) this section in `project.godot`:

```ini
[editor_plugins]

enabled=PackedStringArray("res://addons/gdUnit4/plugin.cfg")
```

- [ ] **Step 3: Write a smoke test**

Create `tests/test_smoke.gd`:

```gdscript
extends GdUnitTestSuite

func test_smoke() -> void:
	assert_that(1 + 1).is_equal(2)
```

- [ ] **Step 4: Run the test runner headlessly and confirm it passes**

Ask the `godot` skill for the exact headless GdUnit4 CLI invocation for this project (it should resolve to something using `C:\Users\Noobi\Godot\Godot_v4.7-stable_win64_console.exe --headless --path .` plus GdUnit4's runner script/args). Run it against `tests/test_smoke.gd` and confirm `test_smoke` reports PASS. If it fails for a reason unrelated to our test (e.g. missing import, addon not detected), fix the addon installation before proceeding — every later task depends on this runner working.

- [ ] **Step 5: Commit**

```bash
git add addons/gdUnit4 project.godot tests/test_smoke.gd
git commit -m "chore: install GdUnit4 test runner"
```

---

### Task 2: Generate golden vectors from the real TS engine

**Files:**
- Create (in the **BetaLife repo**, separate git history): `C:\Users\Noobi\OneDrive\Documents\MoisesGame\BetaLife-main\BetaLife-main\scripts\exportGoldenVectors.ts`
- Create (in **GodotGame**): `tests/fixtures/golden_vectors.json`
- Create (in **GodotGame**): `tests/fixtures/golden_vectors_loader.gd`

**Interfaces:**
- Produces: `GoldenVectors.load() -> Dictionary`, the JSON fixture parsed into a `Dictionary`, consumed by every test task below (Tasks 3–7).

- [ ] **Step 1: Write the export script in BetaLife**

Create `scripts/exportGoldenVectors.ts`:

```typescript
// One-off tool: dumps deterministic engine output for fixed seeds, as JSON,
// to serve as cross-language golden vectors for the Godot/GDScript port.
// Run with: npx ts-node --project tsconfig.json scripts/exportGoldenVectors.ts > out.json

import { createSeeder } from '../src/engine/seeder';
import { generateAxes, readEmergentTraits } from '../src/engine/axes';
import { ARCHETYPES, pickArchetype } from '../src/engine/archetypes';
import {
  bandOf, nearestBand, sealBirthStamp, sealIfBandCrossed, softCeiling,
} from '../src/engine/stamps';
import { generateCulture, generateName, nameNamespaceSize } from '../src/engine/nameGenerator';

const SEEDS = [
  'world-alpha:1001',
  'world-alpha:1002',
  'world-alpha:1003',
  'golden-seed-A',
  'golden-seed-B',
  '', // edge case: empty string seed
];

const CULTURES = ['hispano', 'nordico', 'celta', 'eslavo', 'greco', 'africano', 'asiatico'] as const;

const output: any = {};

// 1. Raw seeder draws: proves mulberry32 + hashString are bit-identical.
output.seederDraws = {};
for (const seed of SEEDS) {
  const s = createSeeder(seed);
  const draws: number[] = [];
  for (let i = 0; i < 10; i++) draws.push(s.next());
  const b = s.branch('axes');
  const branchDraws: number[] = [];
  for (let i = 0; i < 5; i++) branchDraws.push(b.next());
  output.seederDraws[seed] = { draws, branchDraws };
}

// 2. nextFloat / nextInt / nextChoice spot checks.
output.seederHelpers = {};
for (const seed of SEEDS) {
  const s = createSeeder(seed);
  output.seederHelpers[seed] = {
    nextFloatRange: s.nextFloat(10, 20),
    nextInt: s.nextInt(0, 99),
    nextChoice: s.nextChoice(['a', 'b', 'c', 'd', 'e']),
  };
}

// 3. Axes generation: without an archetype, and with each archetype.
output.axes = {};
for (const seed of SEEDS) {
  const noArch = generateAxes(createSeeder(seed));
  const perArchetype: Record<string, any> = {};
  for (const arch of ARCHETYPES) {
    perArchetype[arch.id] = generateAxes(createSeeder(seed), arch);
  }
  output.axes[seed] = { noArchetype: noArch, perArchetype, emergentTraits: readEmergentTraits(noArch) };
}

// 4. Archetype picks.
output.archetypePicks = {};
for (const seed of SEEDS) {
  output.archetypePicks[seed] = pickArchetype(createSeeder(seed)).id;
}

// 5. Stamp helpers.
output.stamps = {
  bandOfSamples: [0, 0.1, 0.124, 0.125, 0.2, 0.4, 0.6, 0.8, 0.9, 1.0]
    .map((v) => ({ value: v, band: bandOf(v) })),
  nearestBandSamples: [0.0, 0.05, 0.12, 0.13, 0.37, 0.5, 0.63, 0.88, 0.95, 1.0]
    .map((v) => ({ value: v, nearest: nearestBand(v) })),
  softCeilingSamples: [
    { value: 0.5, delta: 0.1 }, { value: 0.9, delta: 0.2 }, { value: 0.1, delta: -0.2 },
    { value: 0.99, delta: 0.5 }, { value: 0.01, delta: -0.5 },
  ].map((c) => ({ ...c, result: softCeiling(c.value, c.delta) })),
  growthStamp: sealIfBandCrossed('caution', 0.2, 0.4, 123), // 0.2 (band 1) -> 0.4 (band 2): crosses the 0.375 boundary
  growthStampNone: sealIfBandCrossed('caution', 0.2, 0.24, 123), // both in band 1: no crossing
};
output.birthStamps = {};
for (const seed of SEEDS) {
  const axes = generateAxes(createSeeder(seed));
  const arch = pickArchetype(createSeeder(seed));
  output.birthStamps[seed] = {
    withArchetype: sealBirthStamp(axes, arch, 0),
    withoutArchetype: sealBirthStamp(axes, undefined, 0),
  };
}

// 6. Names.
output.names = {};
for (const seed of SEEDS) {
  const culture = generateCulture(createSeeder(seed));
  const axes = generateAxes(createSeeder(seed));
  const perCulture: Record<string, string> = {};
  for (const c of CULTURES) {
    perCulture[c] = generateName(createSeeder(seed), c, axes);
  }
  output.names[seed] = { culture, perCulture };
}
output.nameNamespaceSize = nameNamespaceSize();

console.log(JSON.stringify(output, null, 2));
```

- [ ] **Step 2: Run it and capture the output**

```bash
cd "C:\Users\Noobi\OneDrive\Documents\MoisesGame\BetaLife-main\BetaLife-main"
npx ts-node --project tsconfig.json scripts/exportGoldenVectors.ts > golden_vectors_output.json
```

Confirm the file is valid JSON and non-empty (open it, spot check a few fields like `seederDraws["world-alpha:1001"].draws[0]` looks like a float in `[0,1)`).

- [ ] **Step 3: Copy the fixture into GodotGame**

Copy `golden_vectors_output.json` from the BetaLife repo to
`C:\Users\Noobi\OneDrive\Documents\GodotGame\tests\fixtures\golden_vectors.json`
(create the `tests/fixtures/` directory if needed). Delete the temporary `golden_vectors_output.json` from the BetaLife repo working tree (the export script itself stays — it's a reusable tool).

- [ ] **Step 4: Write the GDScript loader**

Create `tests/fixtures/golden_vectors_loader.gd`:

```gdscript
class_name GoldenVectors
extends RefCounted

static func load_fixture() -> Dictionary:
	var f := FileAccess.open("res://tests/fixtures/golden_vectors.json", FileAccess.READ)
	var text := f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(text)
	assert(parsed is Dictionary, "golden_vectors.json did not parse to a Dictionary")
	return parsed
```

- [ ] **Step 5: Commit both repos**

In BetaLife:
```bash
cd "C:\Users\Noobi\OneDrive\Documents\MoisesGame\BetaLife-main\BetaLife-main"
git add scripts/exportGoldenVectors.ts
git commit -m "test: add golden-vector exporter for the Godot port"
```

In GodotGame:
```bash
cd "C:\Users\Noobi\OneDrive\Documents\GodotGame"
git add tests/fixtures/golden_vectors.json tests/fixtures/golden_vectors_loader.gd
git commit -m "test: add golden-vector fixture from TS engine"
```

---

### Task 3: Port `seeder.ts` → `scripts/engine/seeder.gd`

**Files:**
- Create: `scripts/engine/seeder.gd`
- Test: `tests/engine/test_seeder.gd`

**Interfaces:**
- Consumes: `GoldenVectors.load_fixture() -> Dictionary` (Task 2)
- Produces: `class_name BLSeeder` with `_init(seed: String)`, `next() -> float`, `next_float(p_min: float = 0.0, p_max: float = 1.0) -> float`, `next_int(p_min: int, p_max: int) -> int`, `next_choice(arr: Array) -> Variant`, `branch(suffix: String) -> BLSeeder`. Every later engine module depends on this exact interface.

This is the **gating task** — nothing else in this plan (or any future plan) can be trusted until this passes. The trickiest part: `seeder.ts`'s `hashString` uses plain `*` (not `Math.imul`) for `h * 0x01000193`, which in JS is a full double-precision multiply that can lose precision for large `h`. We must replicate that imprecision exactly, by also doing that one multiplication in GDScript as a `float` (double) operation — not as exact integer math. The PRNG step in `next()` does use `Math.imul` (exact 32-bit modular multiply), so that part uses real integer arithmetic instead. Comments in the code below explain why.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/test_seeder.gd`:

```gdscript
extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_raw_draws_match_golden_vectors() -> void:
	var seeds: Array = golden["seederDraws"].keys()
	for seed in seeds:
		var s := BLSeeder.new(seed)
		var expected_draws: Array = golden["seederDraws"][seed]["draws"]
		for i in expected_draws.size():
			assert_float(s.next()).is_equal_approx(float(expected_draws[i]), 0.0000001)

func test_branch_draws_match_golden_vectors() -> void:
	var seeds: Array = golden["seederDraws"].keys()
	for seed in seeds:
		var s := BLSeeder.new(seed)
		for i in 10:
			s.next() # consume the same 10 draws the export script consumed before branching
		var b := s.branch("axes")
		var expected_branch: Array = golden["seederDraws"][seed]["branchDraws"]
		for i in expected_branch.size():
			assert_float(b.next()).is_equal_approx(float(expected_branch[i]), 0.0000001)

func test_helpers_match_golden_vectors() -> void:
	var seeds: Array = golden["seederHelpers"].keys()
	for seed in seeds:
		var s := BLSeeder.new(seed)
		var expected: Dictionary = golden["seederHelpers"][seed]
		assert_float(s.next_float(10.0, 20.0)).is_equal_approx(float(expected["nextFloatRange"]), 0.0000001)
	for seed in seeds:
		var s := BLSeeder.new(seed)
		s.next_float(10.0, 20.0) # match the draw order the export script used
		var expected: Dictionary = golden["seederHelpers"][seed]
		assert_int(s.next_int(0, 99)).is_equal(int(expected["nextInt"]))
	for seed in seeds:
		var s := BLSeeder.new(seed)
		s.next_float(10.0, 20.0)
		s.next_int(0, 99)
		var expected: Dictionary = golden["seederHelpers"][seed]
		assert_str(str(s.next_choice(["a", "b", "c", "d", "e"]))).is_equal(str(expected["nextChoice"]))

func test_empty_seed_starts_from_fnv_offset_basis() -> void:
	# Regression guard for the hashString edge case (h never XORed with anything).
	var s := BLSeeder.new("")
	var expected_draws: Array = golden["seederDraws"][""]["draws"]
	for i in expected_draws.size():
		assert_float(s.next()).is_equal_approx(float(expected_draws[i]), 0.0000001)
```

- [ ] **Step 2: Run the test suite to verify it fails**

Run the GdUnit4 headless command established in Task 1 against `tests/engine/test_seeder.gd`. Expected: FAIL — `BLSeeder` does not exist yet (parse/identifier error).

- [ ] **Step 3: Write the implementation**

Create `scripts/engine/seeder.gd`:

```gdscript
class_name BLSeeder
extends RefCounted

## Ports src/engine/seeder.ts (mulberry32 PRNG, FNV-1a string seed hash).
## Determinism is bit-identical to the TS engine for the same seed string —
## see test_seeder.gd, which checks this against real TS-engine output.

var _state: int = 0
var _seed_string: String = ""

func _init(seed: String) -> void:
	_seed_string = seed
	_state = _hash_string(seed)

# Converts an int known to be in [0, 2^32) into its signed 32-bit two's
# complement interpretation, matching how JS treats the result of `^=`.
static func _to_int32(u: int) -> int:
	return u - 4294967296 if u >= 2147483648 else u

# Mirrors JS's ToUint32: the input is always already an integer-valued float
# here (product of two integer-valued doubles), so this just folds it into
# [0, 2^32) — no truncation of a fractional part is ever needed.
static func _to_uint32(x: float) -> int:
	var n: int = int(x)
	var m: int = n % 4294967296
	if m < 0:
		m += 4294967296
	return m

# Replicates JS Math.imul: exact 32-bit signed multiply with wraparound,
# returned here as an unsigned [0, 2^32) value (the bit pattern is what
# matters to callers, not the sign label).
static func _imul32(a: int, b: int) -> int:
	return (a * b) & 0xFFFFFFFF

# Ports hashString() from seeder.ts EXACTLY, including its quirk: the TS code
# writes `h = (h * 0x01000193) >>> 0` using plain `*`, not Math.imul. Plain
# JS `*` is a full IEEE-754 double multiply, which can lose precision for
# |h| this large (up to ~2^31 * ~1.68e7 ≈ 3.6e16, beyond the 2^53 exact-
# integer range of a double). To stay bit-identical we must replicate that
# same precision behavior, not "fix" it — so this multiply is done in
# GDScript as a `float` (also an IEEE-754 double) multiply, never as exact
# integer math. GDScript's `float` and JS's `number` are both binary64, so
# the same multiply produces the same rounded result in both languages.
static func _hash_string(s: String) -> int:
	var h: int = 0x811c9dc5
	for i in s.length():
		h = h ^ s.unicode_at(i)
		var h_signed: int = _to_int32(h)
		h = _to_uint32(float(h_signed) * 16777619.0) # 16777619 == 0x01000193
	return h

func next() -> float:
	_state = (_state + 0x6d2b79f5) & 0xFFFFFFFF
	var z: int = _state
	z = _imul32(z ^ (z >> 15), z | 1)
	z = z ^ ((z + _imul32(z ^ (z >> 7), z | 61)) & 0xFFFFFFFF)
	z = (z ^ (z >> 14)) & 0xFFFFFFFF
	return float(z) / 4294967296.0

func next_float(p_min: float = 0.0, p_max: float = 1.0) -> float:
	return p_min + next() * (p_max - p_min)

func next_int(p_min: int, p_max: int) -> int:
	return int(floor(next_float(float(p_min), float(p_max) + 1.0)))

func next_choice(arr: Array) -> Variant:
	return arr[next_int(0, arr.size() - 1)]

# Derives a child seeder for a sub-domain without disturbing this seeder's
# own state — matches seeder.ts's branch(), which hashes `seed + ':' + suffix`
# from scratch rather than deriving from current PRNG state.
func branch(suffix: String) -> BLSeeder:
	return BLSeeder.new(_seed_string + ":" + suffix)
```

- [ ] **Step 4: Run the test suite to verify it passes**

Run the same GdUnit4 command as Step 2 against `tests/engine/test_seeder.gd`. Expected: all 4 tests PASS.

If `test_raw_draws_match_golden_vectors` fails on the **first** draw for every seed, the bug is in `_hash_string` (the seed-to-initial-state step) — add temporary `print()` calls comparing `_hash_string("world-alpha:1001")`'s intermediate `h` after each loop iteration against manually re-running the TS `hashString` with `console.log` added at the same point, to find exactly where the two diverge.

If it fails only on **later** draws (first draw matches), the bug is in `next()`'s bit manipulation, not the hash.

- [ ] **Step 5: Commit**

```bash
git add scripts/engine/seeder.gd tests/engine/test_seeder.gd
git commit -m "feat: port seeder.ts to GDScript (bit-identical PRNG)"
```

---

### Task 4: Port `axes.ts` → `scripts/engine/axes.gd`

**Files:**
- Create: `scripts/engine/axes.gd`
- Test: `tests/engine/test_axes.gd`

**Interfaces:**
- Consumes: `BLSeeder` (Task 3), `BLArchetypes.OriginArchetype` (Task 5 — but see note below on ordering)
- Produces: `class_name BLAxes` with `const AXIS_KEYS: Array[String]`, `static func generate_axes(seeder: BLSeeder, archetype: Variant = null) -> Dictionary`, `static func read_emergent_traits(axes: Dictionary) -> Array[String]`. `SoulAxes` is represented as a plain `Dictionary[String, float]` keyed by `AXIS_KEYS` — used by every later module that touches an NPC's personality.

Note on ordering: `generate_axes` takes an optional archetype, but only reads `archetype.signature` (a `Dictionary[String, Array]`) — it does not need the `BLArchetypes.OriginArchetype` class to exist yet, since GDScript's `Variant` typing lets us accept anything with a `.signature` property duck-typed at the call site via `archetype.signature` only when non-null. To avoid a forward dependency on Task 5, type the parameter as `Variant` here and access `.signature` directly; Task 5 will pass a real `BLArchetypes.OriginArchetype` once it exists, and Task 6 will too.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/test_axes.gd`:

```gdscript
extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_axis_keys_order_matches_ts() -> void:
	var expected: Array[String] = [
		"caution", "passivity", "submission", "warmth", "trust",
		"altruism", "sociability", "integrity", "loyalty", "optimism",
		"discipline", "curiosity", "confidence", "forgiveness",
	]
	assert_array(BLAxes.AXIS_KEYS).is_equal(expected)

func test_generate_axes_without_archetype_matches_golden_vectors() -> void:
	var seeds: Array = golden["axes"].keys()
	for seed in seeds:
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var expected: Dictionary = golden["axes"][seed]["noArchetype"]
		for key in BLAxes.AXIS_KEYS:
			assert_float(axes[key]).is_equal_approx(float(expected[key]), 0.00001)

func test_read_emergent_traits_matches_golden_vectors() -> void:
	var seeds: Array = golden["axes"].keys()
	for seed in seeds:
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var traits: Array[String] = BLAxes.read_emergent_traits(axes)
		var expected: Array = golden["axes"][seed]["emergentTraits"]
		assert_array(traits).is_equal(expected)

func test_emergent_trait_thresholds() -> void:
	var axes := {
		"caution": 0.5, "passivity": 0.5, "submission": 0.5, "warmth": 0.5, "trust": 0.5,
		"altruism": 0.5, "sociability": 0.5, "integrity": 0.8, "loyalty": 0.8, "optimism": 0.5,
		"discipline": 0.5, "curiosity": 0.5, "confidence": 0.5, "forgiveness": 0.5,
	}
	axes["altruism"] = 0.7
	assert_array(BLAxes.read_emergent_traits(axes)).contains(["honor"])
```

- [ ] **Step 2: Run the test suite to verify it fails**

Expected: FAIL — `BLAxes` does not exist.

- [ ] **Step 3: Write the implementation**

Create `scripts/engine/axes.gd`:

```gdscript
class_name BLAxes
extends RefCounted

## Ports src/engine/axes.ts.

const AXIS_KEYS: Array[String] = [
	"caution", "passivity", "submission", "warmth", "trust",
	"altruism", "sociability", "integrity", "loyalty", "optimism",
	"discipline", "curiosity", "confidence", "forgiveness",
]

static func _round4(value: float) -> float:
	return roundf(value * 10000.0) / 10000.0

static func _generate_axis_value(seeder: BLSeeder) -> float:
	var raw: float = seeder.next_float(0.05, 0.95)
	if raw < 0.5:
		return 0.5 * pow(raw / 0.5, 0.7)
	return 1.0 - 0.5 * pow((1.0 - raw) / 0.5, 0.7)

# `archetype` is duck-typed: pass null for "no archetype", or any object
# exposing a `.signature` Dictionary[String, Array] of [min, max] ranges
# (BLArchetypes.OriginArchetype satisfies this).
static func generate_axes(seeder: BLSeeder, archetype: Variant = null) -> Dictionary:
	var axis_seed: BLSeeder = seeder.branch("axes")
	var axes: Dictionary = {}
	for key in AXIS_KEYS:
		var value: float
		var range_for_key: Variant = null
		if archetype != null and archetype.signature.has(key):
			range_for_key = archetype.signature[key]
		if range_for_key != null:
			var r: Array = range_for_key
			value = axis_seed.next_float(r[0], r[1])
		else:
			value = _generate_axis_value(axis_seed)
		axes[key] = _round4(value)
	return axes

static func read_emergent_traits(axes: Dictionary) -> Array[String]:
	var traits: Array[String] = []
	if axes["integrity"] > 0.7 and axes["loyalty"] > 0.7 and axes["altruism"] > 0.6:
		traits.append("honor")
	if axes["caution"] > 0.65 and axes["discipline"] > 0.65 and axes["curiosity"] > 0.5:
		traits.append("estratega")
	if axes["warmth"] > 0.75 and axes["altruism"] > 0.65:
		traits.append("nobleza")
	if axes["passivity"] < 0.3 and axes["confidence"] > 0.7:
		traits.append("heroísmo")
	if axes["caution"] < 0.3 and axes["discipline"] < 0.35:
		traits.append("imprudencia extrema")
	if axes["trust"] < 0.25 and axes["forgiveness"] < 0.3:
		traits.append("rencor")
	if axes["submission"] > 0.8 and axes["confidence"] < 0.3:
		traits.append("ingenuidad")
	if axes["optimism"] > 0.75 and axes["trust"] > 0.65 and axes["warmth"] > 0.6:
		traits.append("sabiduría benevolente")
	return traits
```

- [ ] **Step 4: Run the test suite to verify it passes**

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/engine/axes.gd tests/engine/test_axes.gd
git commit -m "feat: port axes.ts to GDScript"
```

---

### Task 5: Port `archetypes.ts` → `scripts/engine/archetypes.gd`

**Files:**
- Create: `scripts/engine/archetypes.gd`
- Test: `tests/engine/test_archetypes.gd`

**Interfaces:**
- Consumes: `BLSeeder` (Task 3)
- Produces: `class_name BLArchetypes` containing inner class `OriginArchetype` (fields `id: String`, `weight: float`, `signature: Dictionary`, `primary_axis: String` [`""` = none], `fragments: Array[String]`), `static func get_archetypes() -> Array[OriginArchetype]`, `static func pick_archetype(seeder: BLSeeder) -> OriginArchetype`. Consumed by Task 4's `generate_axes` (already wired via duck typing) and Task 6's `seal_birth_stamp`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/test_archetypes.gd`:

```gdscript
extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_archetype_ids_match_ts() -> void:
	var expected_ids: Array[String] = ["honor", "imprudente", "calido", "rencoroso", "erudito", "difuso"]
	var actual_ids: Array[String] = []
	for a in BLArchetypes.get_archetypes():
		actual_ids.append(a.id)
	assert_array(actual_ids).is_equal(expected_ids)

func test_pick_archetype_matches_golden_vectors() -> void:
	var seeds: Array = golden["archetypePicks"].keys()
	for seed in seeds:
		var picked: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(BLSeeder.new(seed))
		assert_str(picked.id).is_equal(String(golden["archetypePicks"][seed]))

func test_generate_axes_with_each_archetype_matches_golden_vectors() -> void:
	var seeds: Array = golden["axes"].keys()
	for seed in seeds:
		for archetype in BLArchetypes.get_archetypes():
			var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed), archetype)
			var expected: Dictionary = golden["axes"][seed]["perArchetype"][archetype.id]
			for key in BLAxes.AXIS_KEYS:
				assert_float(axes[key]).is_equal_approx(float(expected[key]), 0.00001)

func test_signature_ranges_are_non_empty_for_named_archetypes() -> void:
	for a in BLArchetypes.get_archetypes():
		if a.id != "difuso":
			assert_bool(a.signature.is_empty()).is_false()
		else:
			assert_bool(a.signature.is_empty()).is_true()
```

- [ ] **Step 2: Run the test suite to verify it fails**

Expected: FAIL — `BLArchetypes` does not exist.

- [ ] **Step 3: Write the implementation**

Create `scripts/engine/archetypes.gd`:

```gdscript
class_name BLArchetypes
extends RefCounted

## Ports src/engine/archetypes.ts.

class OriginArchetype:
	extends RefCounted
	var id: String
	var weight: float
	var signature: Dictionary # String -> Array[float] of length 2: [min, max]
	var primary_axis: String  # "" means "no primary axis" (TS: undefined)
	var fragments: Array[String]

	func _init(p_id: String, p_weight: float, p_signature: Dictionary, p_primary_axis: String, p_fragments: Array[String]) -> void:
		id = p_id
		weight = p_weight
		signature = p_signature
		primary_axis = p_primary_axis
		fragments = p_fragments

static func get_archetypes() -> Array[OriginArchetype]:
	return [
		OriginArchetype.new(
			"honor", 1.0,
			{
				"integrity": [0.72, 0.93],
				"loyalty": [0.72, 0.95],
				"altruism": [0.62, 0.88],
			},
			"integrity",
			[
				"Creció en una familia que ponía el honor por encima de la supervivencia.",
				"Aprendió desde joven que romper una promesa era peor que morir.",
				"Su linaje cargó vergüenzas ajenas durante generaciones; juró no añadir más.",
			],
		),
		OriginArchetype.new(
			"imprudente", 1.0,
			{
				"caution": [0.05, 0.28],
				"discipline": [0.05, 0.33],
				"passivity": [0.05, 0.35],
			},
			"caution",
			[
				"Nunca terminó nada que empezó, pero eso nunca le frenó de intentarlo.",
				"Fue expulsado de tres gremios por insubordinación, y está orgulloso de ello.",
				"Sus cicatrices cuentan historias que su memoria ya no puede.",
			],
		),
		OriginArchetype.new(
			"calido", 1.0,
			{
				"warmth": [0.76, 0.96],
				"altruism": [0.66, 0.90],
				"sociability": [0.55, 0.90],
			},
			"warmth",
			[
				"Recogió a mendigos en invierno cuando nadie más lo hacía.",
				"Su puerta nunca estuvo cerrada para los que llegaban con hambre.",
				"Perdió su fortuna ayudando a extraños; nunca lo lamentó del todo.",
			],
		),
		OriginArchetype.new(
			"rencoroso", 1.0,
			{
				"trust": [0.05, 0.24],
				"forgiveness": [0.05, 0.29],
				"warmth": [0.10, 0.45],
			},
			"trust",
			[
				"Alguien a quien amaba lo traicionó. No olvidó. No perdonó.",
				"Aprendió que la confianza es un lujo que los ingenuos pagan caro.",
				"Guarda cada deuda como monedas en un bolso que nunca vacía.",
			],
		),
		OriginArchetype.new(
			"erudito", 1.0,
			{
				"curiosity": [0.76, 0.97],
				"discipline": [0.62, 0.90],
				"caution": [0.55, 0.85],
			},
			"curiosity",
			[
				"Llenó cuadernos enteros antes de cumplir doce años.",
				"Viajó a lugares donde el mapa terminaba solo para ver qué había más allá.",
				"Su maestro dijo que sabía demasiado para su propio bien. Tenía razón.",
			],
		),
		OriginArchetype.new(
			"difuso", 1.5,
			{},
			"",
			[
				"Su pasado es difuso, como arena que el viento remodela continuamente.",
				"No habla de dónde vino. Nadie ha insistido lo suficiente.",
				"Llegó al pueblo sin más pertenencias que lo puesto y una historia a medias.",
			],
		),
	]

static func pick_archetype(seeder: BLSeeder) -> OriginArchetype:
	var a_seeder: BLSeeder = seeder.branch("archetype")
	var archetypes: Array[OriginArchetype] = get_archetypes()
	var total: float = 0.0
	for a in archetypes:
		total += a.weight
	var roll: float = a_seeder.next_float(0.0, total)
	for a in archetypes:
		roll -= a.weight
		if roll < 0.0:
			return a
	return archetypes[archetypes.size() - 1]
```

- [ ] **Step 4: Run the test suite to verify it passes**

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/engine/archetypes.gd tests/engine/test_archetypes.gd
git commit -m "feat: port archetypes.ts to GDScript"
```

---

### Task 6: Port `stamps.ts` → `scripts/engine/stamps.gd`

**Files:**
- Create: `scripts/engine/stamps.gd`
- Test: `tests/engine/test_stamps.gd`

**Interfaces:**
- Consumes: `BLAxes.AXIS_KEYS` (Task 4), `BLArchetypes.OriginArchetype` (Task 5)
- Produces: `class_name BLStamps` containing inner class `Stamp` (fields `kind: String`, `axis_key: String`, `band_value: float`, `sealed_at: int`), `const BANDS`, `static func band_of(value: float) -> int`, `static func nearest_band(value: float) -> float`, `static func seal_birth_stamp(axes: Dictionary, archetype: Variant = null, sealed_at: int = 0) -> Stamp`, `static func seal_if_band_crossed(axis_key: String, old_value: float, new_value: float, sealed_at: int = 0) -> Stamp`, `static func soft_ceiling(value: float, delta: float) -> float`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/test_stamps.gd`:

```gdscript
extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_band_of_matches_golden_vectors() -> void:
	var samples: Array = golden["stamps"]["bandOfSamples"]
	for sample in samples:
		assert_int(BLStamps.band_of(float(sample["value"]))).is_equal(int(sample["band"]))

func test_nearest_band_matches_golden_vectors() -> void:
	var samples: Array = golden["stamps"]["nearestBandSamples"]
	for sample in samples:
		assert_float(BLStamps.nearest_band(float(sample["value"]))).is_equal_approx(float(sample["nearest"]), 0.00001)

func test_soft_ceiling_matches_golden_vectors() -> void:
	var samples: Array = golden["stamps"]["softCeilingSamples"]
	for sample in samples:
		var result: float = BLStamps.soft_ceiling(float(sample["value"]), float(sample["delta"]))
		assert_float(result).is_equal_approx(float(sample["result"]), 0.00001)

func test_seal_if_band_crossed_matches_golden_vectors() -> void:
	var crossed: Dictionary = golden["stamps"]["growthStamp"]
	var stamp: BLStamps.Stamp = BLStamps.seal_if_band_crossed("caution", 0.2, 0.4, 123)
	assert_str(stamp.kind).is_equal(String(crossed["kind"]))
	assert_str(stamp.axis_key).is_equal(String(crossed["axisKey"]))
	assert_float(stamp.band_value).is_equal_approx(float(crossed["bandValue"]), 0.00001)
	assert_int(stamp.sealed_at).is_equal(int(crossed["sealedAt"]))

	var not_crossed: BLStamps.Stamp = BLStamps.seal_if_band_crossed("caution", 0.2, 0.24, 123)
	assert_object(not_crossed).is_null()

func test_seal_birth_stamp_matches_golden_vectors() -> void:
	var seeds: Array = golden["birthStamps"].keys()
	for seed in seeds:
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var arch: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(BLSeeder.new(seed))

		var with_arch: BLStamps.Stamp = BLStamps.seal_birth_stamp(axes, arch, 0)
		var expected_with: Dictionary = golden["birthStamps"][seed]["withArchetype"]
		assert_str(with_arch.axis_key).is_equal(String(expected_with["axisKey"]))
		assert_float(with_arch.band_value).is_equal_approx(float(expected_with["bandValue"]), 0.00001)

		var without_arch: BLStamps.Stamp = BLStamps.seal_birth_stamp(axes, null, 0)
		var expected_without: Dictionary = golden["birthStamps"][seed]["withoutArchetype"]
		assert_str(without_arch.axis_key).is_equal(String(expected_without["axisKey"]))
		assert_float(without_arch.band_value).is_equal_approx(float(expected_without["bandValue"]), 0.00001)
```

- [ ] **Step 2: Run the test suite to verify it fails**

Expected: FAIL — `BLStamps` does not exist.

- [ ] **Step 3: Write the implementation**

Create `scripts/engine/stamps.gd`:

```gdscript
class_name BLStamps
extends RefCounted

## Ports src/engine/stamps.ts.

class Stamp:
	extends RefCounted
	var kind: String      # "birth" | "growth"
	var axis_key: String
	var band_value: float
	var sealed_at: int

	func _init(p_kind: String, p_axis_key: String, p_band_value: float, p_sealed_at: int = 0) -> void:
		kind = p_kind
		axis_key = p_axis_key
		band_value = p_band_value
		sealed_at = p_sealed_at

const BANDS: Array[float] = [0.0, 0.25, 0.5, 0.75, 1.0]
const BAND_BOUNDARIES: Array[float] = [0.125, 0.375, 0.625, 0.875]

static func band_of(value: float) -> int:
	var i: int = 0
	while i < BAND_BOUNDARIES.size() and value >= BAND_BOUNDARIES[i]:
		i += 1
	return i

static func nearest_band(value: float) -> float:
	var best: float = BANDS[0]
	for b in BANDS:
		if absf(b - value) < absf(best - value):
			best = b
	return best

# `archetype` is duck-typed (see axes.gd): null, or anything exposing
# `.primary_axis: String` ("" = none).
static func seal_birth_stamp(axes: Dictionary, archetype: Variant = null, sealed_at: int = 0) -> Stamp:
	var key: String
	if archetype != null and archetype.primary_axis != "":
		key = archetype.primary_axis
	else:
		var max_dist: float = -1.0
		key = "caution"
		for k in BLAxes.AXIS_KEYS:
			var dist: float = absf(axes[k] - 0.5)
			if dist > max_dist:
				max_dist = dist
				key = k
	return Stamp.new("birth", key, nearest_band(axes[key]), sealed_at)

static func seal_if_band_crossed(axis_key: String, old_value: float, new_value: float, sealed_at: int = 0) -> Stamp:
	if band_of(new_value) == band_of(old_value):
		return null
	return Stamp.new("growth", axis_key, nearest_band(new_value), sealed_at)

static func soft_ceiling(value: float, delta: float) -> float:
	var headroom: float = (1.0 - value) if delta > 0.0 else value
	var damping: float = pow(headroom / 0.5, 2.0)
	var next_value: float = value + delta * minf(1.0, damping)
	return clampf(next_value, 0.0, 1.0)
```

- [ ] **Step 4: Run the test suite to verify it passes**

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/engine/stamps.gd tests/engine/test_stamps.gd
git commit -m "feat: port stamps.ts to GDScript"
```

---

### Task 7: Port `nameGenerator.ts` → `scripts/engine/name_generator.gd`

**Files:**
- Create: `scripts/engine/name_generator.gd`
- Test: `tests/engine/test_name_generator.gd`

**Interfaces:**
- Consumes: `BLSeeder` (Task 3), `SoulAxes` `Dictionary` shape (Task 4)
- Produces: `class_name BLNameGenerator` with `const CULTURES: Array[String]`, `static func generate_culture(seeder: BLSeeder) -> String`, `static func generate_name(seeder: BLSeeder, culture: String, axes: Dictionary) -> String`, `static func name_namespace_size() -> int`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/test_name_generator.gd`:

```gdscript
extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_cultures_match_ts() -> void:
	var expected: Array[String] = ["hispano", "nordico", "celta", "eslavo", "greco", "africano", "asiatico"]
	assert_array(BLNameGenerator.CULTURES).is_equal(expected)

func test_generate_culture_matches_golden_vectors() -> void:
	var seeds: Array = golden["names"].keys()
	for seed in seeds:
		var culture: String = BLNameGenerator.generate_culture(BLSeeder.new(seed))
		assert_str(culture).is_equal(String(golden["names"][seed]["culture"]))

func test_generate_name_matches_golden_vectors_per_culture() -> void:
	var seeds: Array = golden["names"].keys()
	for seed in seeds:
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var expected_per_culture: Dictionary = golden["names"][seed]["perCulture"]
		for culture in BLNameGenerator.CULTURES:
			var name: String = BLNameGenerator.generate_name(BLSeeder.new(seed), culture, axes)
			assert_str(name).is_equal(String(expected_per_culture[culture]))

func test_name_namespace_size_matches_golden_vectors() -> void:
	assert_int(BLNameGenerator.name_namespace_size()).is_equal(int(golden["nameNamespaceSize"]))

func test_name_is_capitalized_only_on_first_letter() -> void:
	var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new("capitalization-check"))
	var name: String = BLNameGenerator.generate_name(BLSeeder.new("capitalization-check"), "hispano", axes)
	assert_str(name.substr(0, 1)).is_equal(name.substr(0, 1).to_upper())
	if name.length() > 1:
		assert_str(name.substr(1)).is_equal(name.substr(1).to_lower())
```

- [ ] **Step 2: Run the test suite to verify it fails**

Expected: FAIL — `BLNameGenerator` does not exist.

- [ ] **Step 3: Write the implementation**

Create `scripts/engine/name_generator.gd`:

```gdscript
class_name BLNameGenerator
extends RefCounted

## Ports src/engine/nameGenerator.ts.

const CULTURES: Array[String] = ["hispano", "nordico", "celta", "eslavo", "greco", "africano", "asiatico"]

const PHONEMES: Dictionary = {
	"hispano": {
		"pre": ["Al", "El", "Ca", "Mar", "Ra", "Sol", "Ven", "Bel", "Dar", "Gal", "Cor", "Ser", "Tan", "Lun", "Vel", "Bra", "Cas", "Fer", "Nor", "Sal", "Tor", "Mer"],
		"root": ["an", "or", "en", "al", "ir", "os", "ar", "ur", "es", "iel", "ael", "and", "eri", "ond", "ial", "uel", "anz", "erm", "ost", "ind", "alv", "ern"],
		"mid": ["a", "e", "i", "o", "ri", "li", "na", "se", "ta", "va", "ra", "le", "mi", "no", "da", "ne", "lo", "sa", "te", "vi", "ro", "ca"],
		"suf": ["o", "a", "io", "ia", "on", "an", "in", "el", "ez", "ar", "os", "eo", "un", "il", "az", "or", "ano", "ina", "eno", "ius", "alo", "eria"],
	},
	"nordico": {
		"pre": ["Bjor", "Thor", "Sig", "Ulf", "Heid", "Gur", "Rag", "Var", "Frey", "Arn", "Eir", "Hak", "Sten", "Grim", "Hald", "Sval", "Orm", "Tyr", "Skar", "Volk", "Gunn", "Rurik"],
		"root": ["nar", "vik", "ald", "ulf", "mund", "gar", "helm", "bor", "den", "fen", "rik", "stein", "grim", "vald", "skog", "thal", "norn", "gisl", "rond", "hild", "svein", "falk"],
		"mid": ["a", "e", "i", "o", "u", "da", "ne", "la", "ri", "va", "sa", "to", "ke", "no", "ga", "me", "lo", "se", "ta", "vi", "do", "ru"],
		"suf": ["son", "ir", "en", "ar", "ur", "ik", "on", "r", "n", "a", "dr", "ulf", "ald", "mir", "gar", "vid", "rok", "nir", "helm", "stad", "und", "borg"],
	},
	"celta": {
		"pre": ["Bran", "Cai", "Der", "Fio", "Gor", "Mor", "Nua", "Rhi", "Tal", "Eil", "Aed", "Bre", "Cael", "Dun", "Ferg", "Gwyn", "Lugh", "Niamh", "Oran", "Sael", "Teag", "Caw"],
		"root": ["agh", "wyn", "eth", "ael", "dhu", "ran", "ban", "hir", "enn", "mor", "lyr", "wen", "tach", "gwel", "nith", "arod", "beth", "cael", "duin", "fael", "goch", "lain"],
		"mid": ["a", "e", "i", "y", "o", "ai", "we", "ru", "na", "li", "dy", "ce", "ma", "ne", "lo", "ri", "sa", "te", "vi", "do", "el", "in"],
		"suf": ["an", "yn", "on", "wen", "ith", "och", "ach", "ael", "in", "ion", "wyn", "dd", "ek", "rys", "agh", "ven", "lyn", "mor", "gan", "ed", "ys", "aith"],
	},
	"eslavo": {
		"pre": ["Dra", "Mir", "Bog", "Vla", "Svet", "Kaz", "Rad", "Zla", "Yar", "Gor", "Bor", "Lud", "Sta", "Tom", "Ves", "Woj", "Zor", "Bran", "Dmi", "Ksen", "Mst", "Rus"],
		"root": ["imir", "odar", "oslav", "adin", "enka", "idar", "omir", "ivan", "usha", "olan", "eslav", "omil", "aros", "imko", "enko", "oryn", "astan", "evod", "islav", "omash", "uril", "azek"],
		"mid": ["a", "e", "i", "o", "u", "ya", "ne", "ri", "lo", "va", "sa", "do", "ze", "na", "mi", "to", "le", "ro", "se", "vi", "da", "ko"],
		"suf": ["ov", "ev", "a", "in", "ko", "mir", "ski", "ych", "nov", "uk", "enko", "slav", "omir", "ek", "ina", "oslav", "ich", "an", "ar", "el", "osh", "yna"],
	},
	"greco": {
		"pre": ["Alex", "Kali", "The", "Dem", "Nik", "Pho", "Kyr", "Ath", "Eos", "Kro", "Lys", "Mel", "Orph", "Pan", "Sel", "Tha", "Xen", "Zeph", "Arist", "Diog", "Hera", "Leon"],
		"root": ["andr", "istr", "oph", "eter", "akis", "ipos", "enos", "aros", "iran", "okas", "andro", "ekle", "imen", "ophan", "ister", "agor", "edon", "ophil", "arch", "eides", "olaos", "ythen"],
		"mid": ["a", "e", "i", "o", "io", "ia", "es", "os", "an", "el", "on", "er", "al", "is", "or", "en", "ar", "ne", "ro", "ti", "le", "me"],
		"suf": ["os", "is", "as", "on", "ia", "e", "us", "ios", "eos", "anes", "ides", "andros", "ikos", "enes", "ator", "okles", "iton", "aios", "eus", "oros", "ipos", "ymos"],
	},
	"africano": {
		"pre": ["Ama", "Kwa", "Zub", "Osi", "Lek", "Tau", "Aya", "Ngo", "Eba", "Ima", "Bara", "Chid", "Dala", "Femi", "Jabu", "Kofi", "Mosi", "Nuru", "Obi", "Sade", "Thabo", "Zola"],
		"root": ["inde", "ara", "ube", "ole", "abo", "ema", "uru", "ike", "enu", "olo", "andi", "eshe", "iola", "unde", "abeo", "imba", "okon", "esha", "ulum", "anke", "ireh", "oseh"],
		"mid": ["a", "e", "i", "o", "u", "na", "we", "lo", "mi", "ba", "ya", "se", "ko", "ru", "da", "le", "ni", "to", "sa", "wo", "ma", "zu"],
		"suf": ["we", "a", "i", "u", "e", "yo", "ba", "ko", "si", "tu", "la", "na", "di", "mba", "nde", "ola", "esi", "ayo", "umi", "eke", "oro", "isha"],
	},
	"asiatico": {
		"pre": ["Ren", "Yuki", "Hiro", "Min", "Tao", "Xia", "Jun", "Hana", "Ryu", "Mei", "Kai", "Lin", "Nao", "Qing", "Sora", "Wei", "Yi", "Zhen", "Akio", "Daiki", "Feng", "Haru"],
		"root": ["saki", "zen", "taro", "fang", "nori", "yama", "haru", "kaze", "moto", "shiro", "jian", "kawa", "long", "mura", "sora", "tian", "waka", "xing", "yoshi", "zhao", "hoshi", "inu"],
		"mid": ["a", "e", "i", "o", "u", "no", "ka", "mi", "ra", "shi", "ko", "na", "to", "ya", "ki", "ru", "sa", "chi", "ma", "wa", "zu", "ne"],
		"suf": ["ko", "ka", "ki", "ro", "to", "na", "mi", "shi", "ra", "yu", "ji", "sho", "taro", "hito", "ren", "sei", "long", "feng", "lan", "wei", "ying", "hua"],
	},
}

static func _phonetic_hardness(axes: Dictionary) -> float:
	return (1.0 - float(axes["passivity"])) * 0.5 + (1.0 - float(axes["warmth"])) * 0.5

# Ports hardenName()'s three regex passes exactly:
#   1. /v/gi -> 'k'
#   2. /l([aeiou])/gi -> 'r$1'
#   3. /[aeiou]{2}/gi -> first char of the match (non-overlapping scan)
static func _harden_name(name: String, hardness: float) -> String:
	if hardness < 0.55:
		return name
	var result: String = name

	var re_v := RegEx.new()
	re_v.compile("[vV]")
	result = re_v.sub(result, "k", true)

	var re_l := RegEx.new()
	re_l.compile("[lL]([aeiouAEIOU])")
	result = re_l.sub(result, "r$1", true)

	var re_vv := RegEx.new()
	re_vv.compile("([aeiouAEIOU])[aeiouAEIOU]")
	result = re_vv.sub(result, "$1", true)

	return result

static func generate_culture(seeder: BLSeeder) -> String:
	return String(seeder.branch("culture").next_choice(CULTURES))

static func _unique_count(arr: Array) -> int:
	var seen: Dictionary = {}
	for v in arr:
		seen[v] = true
	return seen.size()

static func name_namespace_size() -> int:
	var total: int = 0
	for culture in CULTURES:
		var pool: Dictionary = PHONEMES[culture]
		total += _unique_count(pool["pre"]) * _unique_count(pool["root"]) * _unique_count(pool["mid"]) * _unique_count(pool["suf"])
	return total

static func generate_name(seeder: BLSeeder, culture: String, axes: Dictionary) -> String:
	var ns: BLSeeder = seeder.branch("name")
	var pool: Dictionary = PHONEMES[culture]
	var pre: String = String(ns.next_choice(pool["pre"]))
	var root: String = String(ns.next_choice(pool["root"]))
	var mid: String = String(ns.next_choice(pool["mid"]))
	var suf: String = String(ns.next_choice(pool["suf"]))

	var raw: String = pre + root + mid + suf
	var name: String = raw.substr(0, 1).to_upper() + raw.substr(1).to_lower()
	return _harden_name(name, _phonetic_hardness(axes))
```

- [ ] **Step 4: Run the test suite to verify it passes**

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/engine/name_generator.gd tests/engine/test_name_generator.gd
git commit -m "feat: port nameGenerator.ts to GDScript"
```

---

### Task 8: Milestone-1 integration test

**Files:**
- Test: `tests/engine/test_milestone1_integration.gd`

**Interfaces:**
- Consumes: `BLSeeder`, `BLAxes`, `BLArchetypes`, `BLStamps`, `BLNameGenerator` (Tasks 3–7)
- Produces: nothing new — this is a cross-module coherence check, mirroring the assertions `scripts/testEngine.ts` makes about stamp↔origin and emergent↔origin coherence (lines ~61–107 of that file), scoped to what Milestone 1 actually ported (no full `NPC`, since `npcGenerator`/`town`/`world` are out of scope here).

- [ ] **Step 1: Write the test**

Create `tests/engine/test_milestone1_integration.gd`:

```gdscript
extends GdUnitTestSuite

# Mirrors the coherence checks in BetaLife's scripts/testEngine.ts (lines ~61-107),
# scoped to the modules ported in Milestone 1: seeder, axes, archetypes, stamps,
# nameGenerator. Full NPC-level coherence (which also touches npcGenerator/town/
# world) is re-verified in the Milestone 2 plan once those are ported.

const SAMPLE_SIZE: int = 500

func test_determinism_same_seed_same_output() -> void:
	for trial in 5:
		var seed: String = "determinism-check:%d" % trial
		var axes_a: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var axes_b: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		assert_dict(axes_a).is_equal(axes_b)

		var name_a: String = BLNameGenerator.generate_name(BLSeeder.new(seed), "hispano", axes_a)
		var name_b: String = BLNameGenerator.generate_name(BLSeeder.new(seed), "hispano", axes_b)
		assert_str(name_a).is_equal(name_b)

func test_birth_stamp_seals_archetype_primary_axis() -> void:
	# Every NPC whose archetype declares a primaryAxis must have its birth
	# stamp on exactly that axis (stamp <-> origin coherence).
	for i in SAMPLE_SIZE:
		var seed: String = "coherence:%d" % i
		var arch: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(BLSeeder.new(seed))
		if arch.primary_axis == "":
			continue
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed), arch)
		var stamp: BLStamps.Stamp = BLStamps.seal_birth_stamp(axes, arch, 0)
		assert_str(stamp.axis_key).is_equal(arch.primary_axis)

func test_emergent_trait_correlates_with_archetype() -> void:
	# Each named archetype should make its matching emergent trait fire for
	# the large majority of rolls (not 100% - the other AND-conditions vary).
	var expected_trait_for_archetype: Dictionary = {
		"honor": "honor",
		"imprudente": "imprudencia extrema",
		"calido": "nobleza",
		"rencoroso": "rencor",
	}
	var hits: Dictionary = {}
	var totals: Dictionary = {}
	for id in expected_trait_for_archetype.keys():
		hits[id] = 0
		totals[id] = 0

	for i in SAMPLE_SIZE:
		var seed: String = "coherence:%d" % i
		var arch: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(BLSeeder.new(seed))
		if not expected_trait_for_archetype.has(arch.id):
			continue
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed), arch)
		totals[arch.id] += 1
		var traits: Array[String] = BLAxes.read_emergent_traits(axes)
		if traits.has(expected_trait_for_archetype[arch.id]):
			hits[arch.id] += 1

	for id in expected_trait_for_archetype.keys():
		if totals[id] == 0:
			continue
		var rate: float = float(hits[id]) / float(totals[id])
		assert_float(rate).is_greater(0.7) # generous floor; TS run typically shows 80-95%+

func test_name_uniqueness_across_many_seeds() -> void:
	var names: Dictionary = {}
	var collisions: int = 0
	for i in SAMPLE_SIZE:
		var seed: String = "distrib-test:%d" % i
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var culture: String = BLNameGenerator.generate_culture(BLSeeder.new(seed))
		var name: String = BLNameGenerator.generate_name(BLSeeder.new(seed), culture, axes)
		if names.has(name):
			collisions += 1
		names[name] = true
	assert_int(collisions).is_equal(0)
```

- [ ] **Step 2: Run the full Milestone 1 test suite**

Run the GdUnit4 headless command (Task 1) against `tests/engine/` (all files). Expected: every test across `test_seeder.gd`, `test_axes.gd`, `test_archetypes.gd`, `test_stamps.gd`, `test_name_generator.gd`, and `test_milestone1_integration.gd` PASSes.

If `test_emergent_trait_correlates_with_archetype` fails (rate too low), the bug is most likely in `BLAxes.generate_axes`'s archetype-biased range sampling (Task 4) or `BLAxes.read_emergent_traits`'s thresholds — re-check both against `axes.ts` line-by-line, since this test is sensitive to subtle range/threshold transcription errors that the narrower per-module tests might not catch.

- [ ] **Step 3: Commit**

```bash
git add tests/engine/test_milestone1_integration.gd
git commit -m "test: add Milestone 1 cross-module coherence checks"
```

---

## What's next

Milestone 1 leaves a deterministic, tested foundation: RNG, soul axes, origin archetypes, growth/birth stamps, and name generation — all bit-identical to the TS engine. The next plan (Milestone 2, to be written separately) ports `types.ts` (full `NPC` shape), `npcGenerator.ts`, `town.ts`, `world.ts`, and `historyGenerator.ts` — the modules that assemble a complete `NPC`, per the dependency order in the spec (`docs/superpowers/specs/2026-06-30-engine-port-design.md`).
