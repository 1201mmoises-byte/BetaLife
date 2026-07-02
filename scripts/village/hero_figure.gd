class_name BLHeroFigure
extends Node3D

## Reusable role-colored hero figure: stacked primitive meshes (legs/torso/
## head, per the village-base-3d-scene-design spec's "Hero figures + fairy"
## section) colored at spawn time from BLHeroFactory.ROLE_VIS. Motion this
## phase is intentionally a placeholder — idle breathing bob + a slow drift
## to a randomly-chosen BLSpots spot, pause, repeat (Phase 4 replaces this
## with real needs/activity-driven movement per the spec's Amendment 3).
##
## set_destination() is the swappable seam the brief calls for: the internal
## wander logic below (_wander_to_random_spot) is just one caller of it.
## Phase 4's village_sim.gd can call set_destination() directly instead,
## driving the same walk/arrive/bob machinery without this file changing.

# ---------------------------------------------------------------------------
# Body proportions
# ---------------------------------------------------------------------------

const LEG_WIDTH: float = 0.3
const LEG_HEIGHT: float = 0.7
const TORSO_WIDTH: float = 0.5
const TORSO_HEIGHT: float = 0.6
const TORSO_DEPTH: float = 0.3
const HEAD_RADIUS: float = 0.22

const TORSO_CENTER_Y: float = LEG_HEIGHT + TORSO_HEIGHT * 0.5
const HEAD_CENTER_Y: float = LEG_HEIGHT + TORSO_HEIGHT + HEAD_RADIUS
const LABEL_HEIGHT: float = HEAD_CENTER_Y + HEAD_RADIUS + 0.3

# ---------------------------------------------------------------------------
# Motion (placeholder — see file header)
# ---------------------------------------------------------------------------

const BOB_AMPLITUDE: float = 0.05
const BOB_SPEED: float = 1.6

const WALK_SPEED: float = 1.2
const ARRIVE_EPSILON: float = 0.15
const PAUSE_DURATION_MIN: float = 2.0
const PAUSE_DURATION_MAX: float = 5.0

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

var hero: Dictionary = {}

var _legs: MeshInstance3D
var _torso: MeshInstance3D
var _head: MeshInstance3D
var _headgear: MeshInstance3D
var _label: Label3D

var _ground_position: Vector3 = Vector3.ZERO
var _bob_phase: float = 0.0
var _destination: Vector3 = Vector3.ZERO
var _has_destination: bool = false
var _pause_timer: float = 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_ground_position = position
	_build_figure()


## Colors the figure per hero.role (must be a BLHeroFactory.ROLE_VIS key,
## falls back to "warrior" otherwise) and sets the name label. Call after
## this node is already in the tree (so _ready() has built the mesh
## children) — village_base.gd's spawn helper follows add_child() with
## setup(), matching every other builder in this scene (see structures.gd).
func setup(p_hero: Dictionary) -> void:
	hero = p_hero

	# Cosmetic-only jitter (bob phase, wander pause timing) seeded from the
	## hero's own seed so re-entering the village with the same roster looks
	## the same, without this file needing to touch BLSeeder itself — motion
	## here is view-layer placeholder, not engine-determinism-critical.
	_rng.seed = hash(String(hero.get("seed", "")))
	_bob_phase = _rng.randf_range(0.0, TAU)
	_pause_timer = _rng.randf_range(0.0, PAUSE_DURATION_MAX)

	var role: String = String(hero.get("role", "warrior"))
	var vis: Dictionary = BLHeroFactory.ROLE_VIS.get(role, BLHeroFactory.ROLE_VIS["warrior"])

	_legs.material_override = _flat_material(vis["legs"])
	_torso.material_override = _flat_material(vis["armor"])
	_head.material_override = _flat_material(vis["skin"])
	_headgear.material_override = _flat_material(vis["accent"])
	_shape_headgear(String(vis.get("headgear", "cap")))

	_label.text = String(hero.get("name", "???"))


func _process(delta: float) -> void:
	if _has_destination:
		_step_toward_destination(delta)
	else:
		_pause_timer -= delta
		if _pause_timer <= 0.0:
			_wander_to_random_spot()

	_bob_phase += delta * BOB_SPEED
	position = _ground_position + Vector3(0.0, sin(_bob_phase) * BOB_AMPLITUDE, 0.0)


## The swappable "where am I going" seam (see file header). `pos`'s y is
## ignored — figures always walk on the ground plane.
func set_destination(pos: Vector3) -> void:
	_destination = Vector3(pos.x, _ground_position.y, pos.z)
	_has_destination = true


func _wander_to_random_spot() -> void:
	var names: Array[String] = BLSpots.all_names()
	var spot_name: String = names[_rng.randi_range(0, names.size() - 1)]
	set_destination(BLSpots.position_of(spot_name))


func _step_toward_destination(delta: float) -> void:
	var to_dest: Vector3 = _destination - _ground_position
	to_dest.y = 0.0

	if to_dest.length() <= ARRIVE_EPSILON:
		_has_destination = false
		_pause_timer = _rng.randf_range(PAUSE_DURATION_MIN, PAUSE_DURATION_MAX)
		return

	var direction: Vector3 = to_dest.normalized()
	var step: Vector3 = direction * WALK_SPEED * delta
	if step.length() >= to_dest.length():
		_ground_position = Vector3(_destination.x, _ground_position.y, _destination.z)
	else:
		_ground_position += step
		look_at(_ground_position + direction, Vector3.UP)


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------

func _build_figure() -> void:
	_legs = MeshInstance3D.new()
	_legs.name = "Legs"
	var legs_mesh := BoxMesh.new()
	legs_mesh.size = Vector3(LEG_WIDTH, LEG_HEIGHT, LEG_WIDTH)
	_legs.mesh = legs_mesh
	_legs.position = Vector3(0.0, LEG_HEIGHT * 0.5, 0.0)
	add_child(_legs)

	_torso = MeshInstance3D.new()
	_torso.name = "Torso"
	var torso_mesh := BoxMesh.new()
	torso_mesh.size = Vector3(TORSO_WIDTH, TORSO_HEIGHT, TORSO_DEPTH)
	_torso.mesh = torso_mesh
	_torso.position = Vector3(0.0, TORSO_CENTER_Y, 0.0)
	add_child(_torso)

	_head = MeshInstance3D.new()
	_head.name = "Head"
	var head_mesh := SphereMesh.new()
	head_mesh.radius = HEAD_RADIUS
	head_mesh.height = HEAD_RADIUS * 2.0
	_head.mesh = head_mesh
	_head.position = Vector3(0.0, HEAD_CENTER_Y, 0.0)
	add_child(_head)

	_headgear = MeshInstance3D.new()
	_headgear.name = "Headgear"
	add_child(_headgear) # mesh assigned per-kind by setup() -> _shape_headgear()

	_label = Label3D.new()
	_label.name = "NameLabel"
	_label.position = Vector3(0.0, LABEL_HEIGHT, 0.0)
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.font_size = 32
	_label.outline_size = 8
	_label.modulate = Color(1.0, 1.0, 1.0)
	_label.outline_modulate = Color(0.0, 0.0, 0.0, 0.85)
	add_child(_label)


## Shapes `_headgear`'s mesh per BLHeroFactory.ROLE_VIS's "headgear" kind —
## a small distinguishing silhouette on top of the head, not full costume
## detail (this is a primitive-port placeholder figure, not final art).
func _shape_headgear(kind: String) -> void:
	match kind:
		"helmet":
			var box := BoxMesh.new()
			box.size = Vector3(HEAD_RADIUS * 1.6, HEAD_RADIUS * 0.6, HEAD_RADIUS * 1.6)
			_headgear.mesh = box
			_headgear.position = Vector3(0.0, HEAD_CENTER_Y + HEAD_RADIUS * 0.7, 0.0)
		"hood":
			var sphere := SphereMesh.new()
			sphere.radius = HEAD_RADIUS * 1.15
			sphere.height = HEAD_RADIUS * 1.6
			_headgear.mesh = sphere
			_headgear.position = Vector3(0.0, HEAD_CENTER_Y + HEAD_RADIUS * 0.35, 0.0)
		_: # "cap" and any unrecognized kind
			var cyl := CylinderMesh.new()
			cyl.top_radius = HEAD_RADIUS * 0.75
			cyl.bottom_radius = HEAD_RADIUS * 0.95
			cyl.height = HEAD_RADIUS * 0.5
			_headgear.mesh = cyl
			_headgear.position = Vector3(0.0, HEAD_CENTER_Y + HEAD_RADIUS * 0.85, 0.0)


static func _flat_material(color: Color, roughness: float = 0.8) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = roughness
	mat.metallic = 0.0
	return mat
