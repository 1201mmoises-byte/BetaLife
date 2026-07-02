class_name BLFlickerLight
extends OmniLight3D

## Warm flickering point light for the Plaza campfire — slight energy
## oscillation (sine wave + small random jitter) per the village-base-3d
## scene design spec's "warm flickering OmniLight3D (slight energy
## oscillation ok)." Cheap: no particles, just a per-frame scalar tweak.

@export var base_energy: float = 2.4
@export var flicker_amplitude: float = 0.4
@export var flicker_speed: float = 6.0

var _rng := RandomNumberGenerator.new()
var _t: float = 0.0


func _ready() -> void:
	_rng.randomize()


func _process(delta: float) -> void:
	_t += delta * flicker_speed
	var jitter: float = _rng.randf_range(-1.0, 1.0) * flicker_amplitude * 0.25
	light_energy = base_energy + sin(_t) * flicker_amplitude + jitter
