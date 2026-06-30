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
