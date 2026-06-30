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
