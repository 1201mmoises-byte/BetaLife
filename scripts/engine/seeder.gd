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
