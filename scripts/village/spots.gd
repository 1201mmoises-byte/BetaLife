class_name BLSpots
extends RefCounted

## Named-position registry for the village's 6 fixed structures. Mirrors the
## previz's `PLACES`/`place()` (slice.js). Pure lookup, no Nodes — safe to
## unit-test headlessly and to call from any script (village_base.gd's
## camera pan clamp, later structure/hero spawn code, etc).
##
## Previz coordinates are 2D (x, z-ish "depth"); this maps them onto the
## ground plane as Vector3(x, 0, second_coord).

const POSITIONS: Dictionary = {
	"torre": Vector3(0, 0, -8),
	"shrine": Vector3(-6, 0, 3),
	"posada": Vector3(7, 0, -2),
	"campo": Vector3(6, 0, 5),
	"fusion": Vector3(-7, 0, -4),
	"plaza": Vector3(0, 0, 1),
}

## Returns the ground-plane (y=0) position of a named spot. Unknown names
## return Vector3.ZERO (which is not itself a valid spot position, so it's
## an unambiguous sentinel) rather than erroring — but a push_warning fires
## first so a typo'd spot name doesn't silently place a structure/hero at
## the village center.
static func position_of(spot_name: String) -> Vector3:
	if not POSITIONS.has(spot_name):
		push_warning("BLSpots.position_of: unknown spot name '%s', returning Vector3.ZERO" % spot_name)
		return Vector3.ZERO
	return POSITIONS[spot_name]


## All known spot names, in POSITIONS declaration order.
static func all_names() -> Array[String]:
	var names: Array[String] = []
	for spot_name in POSITIONS.keys():
		names.append(spot_name)
	return names
