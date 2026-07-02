class_name BLFairyAvatar
extends Node3D

## Small glowing capsule + wing quads, per the village-base-3d-scene-design
## spec's "Hero figures + fairy" section (mirrors previz's buildFairy()).
## Wanders independently of hero figures around the village center. No
## dialogue/personality hookup here — that's already-decided-separately
## future work (see project memory's "Time dilation + fairy tone" entry);
## this is only the physical avatar.

const BODY_RADIUS: float = 0.18
const BODY_HEIGHT: float = 0.5
const WING_SIZE: Vector2 = Vector2(0.35, 0.22)

const HOVER_AMPLITUDE: float = 0.12
const HOVER_SPEED: float = 2.2
const WING_FLAP_SPEED: float = 9.0
const WING_FLAP_AMPLITUDE_DEG: float = 35.0

const WANDER_HEIGHT: float = 2.2
const WANDER_RADIUS: float = 10.0
const WANDER_SPEED: float = 0.8
const ARRIVE_EPSILON: float = 0.2
const PAUSE_DURATION_MIN: float = 3.0
const PAUSE_DURATION_MAX: float = 7.0

const EMISSIVE_VIOLET: Color = Color(0.62, 0.32, 0.95)
const EMISSIVE_GOLD: Color = Color(1.0, 0.80, 0.35)

var _body: MeshInstance3D
var _wing_left: MeshInstance3D
var _wing_right: MeshInstance3D
var _light: OmniLight3D

var _ground_position: Vector3 = Vector3(0.0, WANDER_HEIGHT, 0.0)
var _hover_phase: float = 0.0
var _flap_phase: float = 0.0
var _destination: Vector3 = Vector3.ZERO
var _has_destination: bool = false
var _pause_timer: float = 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	_ground_position = Vector3(position.x, WANDER_HEIGHT, position.z)
	_build_fairy()


func _process(delta: float) -> void:
	if _has_destination:
		_step_toward_destination(delta)
	else:
		_pause_timer -= delta
		if _pause_timer <= 0.0:
			_wander_to_random_point()

	_hover_phase += delta * HOVER_SPEED
	position = _ground_position + Vector3(0.0, sin(_hover_phase) * HOVER_AMPLITUDE, 0.0)

	_flap_phase += delta * WING_FLAP_SPEED
	var flap_deg: float = sin(_flap_phase) * WING_FLAP_AMPLITUDE_DEG
	_wing_left.rotation_degrees.z = flap_deg
	_wing_right.rotation_degrees.z = -flap_deg


## Same swappable seam as BLHeroFigure.set_destination() — kept independent
## rather than shared, since the fairy has no roster record to key jitter
## off of and wanders around the village center, not between named spots.
func set_destination(pos: Vector3) -> void:
	_destination = Vector3(pos.x, WANDER_HEIGHT, pos.z)
	_has_destination = true


func _wander_to_random_point() -> void:
	var angle: float = _rng.randf_range(0.0, TAU)
	var radius: float = _rng.randf_range(0.0, WANDER_RADIUS)
	set_destination(Vector3(cos(angle) * radius, WANDER_HEIGHT, sin(angle) * radius))


func _step_toward_destination(delta: float) -> void:
	var to_dest: Vector3 = _destination - _ground_position
	to_dest.y = 0.0

	if to_dest.length() <= ARRIVE_EPSILON:
		_has_destination = false
		_pause_timer = _rng.randf_range(PAUSE_DURATION_MIN, PAUSE_DURATION_MAX)
		return

	var step: Vector3 = to_dest.normalized() * WANDER_SPEED * delta
	if step.length() >= to_dest.length():
		_ground_position = Vector3(_destination.x, WANDER_HEIGHT, _destination.z)
	else:
		_ground_position += step


func _build_fairy() -> void:
	_body = MeshInstance3D.new()
	_body.name = "Body"
	var capsule := CapsuleMesh.new()
	capsule.radius = BODY_RADIUS
	capsule.height = BODY_HEIGHT
	_body.mesh = capsule
	_body.material_override = _emissive_material(EMISSIVE_VIOLET, 3.5)
	add_child(_body)

	_wing_left = _build_wing(-1.0)
	_wing_right = _build_wing(1.0)

	_light = OmniLight3D.new()
	_light.name = "FairyGlow"
	_light.light_color = EMISSIVE_VIOLET
	_light.light_energy = 1.4
	_light.omni_range = 3.5
	add_child(_light)


func _build_wing(side: float) -> MeshInstance3D:
	var wing := MeshInstance3D.new()
	wing.name = "WingLeft" if side < 0.0 else "WingRight"
	var quad := QuadMesh.new()
	quad.size = WING_SIZE
	wing.mesh = quad
	wing.material_override = _emissive_material(EMISSIVE_GOLD, 2.5, 0.25)
	wing.position = Vector3(side * WING_SIZE.x * 0.5, BODY_HEIGHT * 0.15, -0.02)
	add_child(wing)
	return wing


static func _emissive_material(color: Color, energy: float, base_dim: float = 0.35) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color * base_dim
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = energy
	mat.roughness = 0.5
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED # wing quads read from both sides
	return mat
