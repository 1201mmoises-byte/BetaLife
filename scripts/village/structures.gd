class_name BLStructures
extends RefCounted

## Phase 2B: the village's six fixed structures, primitive-mesh built, per
## `docs/superpowers/specs/2026-07-01-village-base-3d-scene-design.md`'s
## structures table and per-structure construction notes. One static
## `build_*` func per structure — each returns a fully-assembled Node3D
## subtree (body + roof/trim + emissives/lights + Label3D name label),
## already positioned via `BLSpots` — ready for `village_base.gd` to
## `add_child()` directly. No hardcoded coordinates: every root position
## comes from `BLSpots.position_of()`.

# ---------------------------------------------------------------------------
# Palette — earthy/stone base tones + violet/gold accents (game identity)
# ---------------------------------------------------------------------------

const STONE_COLOR: Color = Color(0.46, 0.43, 0.39)
const DARK_STONE_COLOR: Color = Color(0.14, 0.14, 0.17)
const WOOD_COLOR: Color = Color(0.36, 0.24, 0.15)
const ROOF_COLOR: Color = Color(0.52, 0.18, 0.14)
const DIRT_COLOR: Color = Color(0.50, 0.40, 0.27)
const GOLD_TRIM_COLOR: Color = Color(0.62, 0.50, 0.24)

const EMISSIVE_GOLD: Color = Color(1.0, 0.80, 0.35)
const EMISSIVE_WARM: Color = Color(1.0, 0.62, 0.24)
const EMISSIVE_PURPLE: Color = Color(0.62, 0.32, 0.95)
const EMISSIVE_COOL: Color = Color(0.35, 0.72, 0.92)

# ---------------------------------------------------------------------------
# Torre — visual anchor, tallest, not enterable
# ---------------------------------------------------------------------------

const TORRE_BODY_RADIUS: float = 1.3
const TORRE_BODY_HEIGHT: float = 5.0
const TORRE_ROOF_RADIUS: float = 1.6
const TORRE_ROOF_HEIGHT: float = 2.6
const TORRE_WINDOW_COUNT: int = 5

static func build_torre() -> Node3D:
	var root := Node3D.new()
	root.name = "Torre"
	root.position = BLSpots.position_of("torre")

	var body := MeshInstance3D.new()
	var body_mesh := CylinderMesh.new()
	body_mesh.top_radius = TORRE_BODY_RADIUS
	body_mesh.bottom_radius = TORRE_BODY_RADIUS
	body_mesh.height = TORRE_BODY_HEIGHT
	body_mesh.radial_segments = 16
	body.mesh = body_mesh
	body.material_override = _flat_material(STONE_COLOR)
	body.position = Vector3(0.0, TORRE_BODY_HEIGHT * 0.5, 0.0)
	root.add_child(body)

	var roof := MeshInstance3D.new()
	var roof_mesh := CylinderMesh.new()
	roof_mesh.top_radius = 0.0
	roof_mesh.bottom_radius = TORRE_ROOF_RADIUS
	roof_mesh.height = TORRE_ROOF_HEIGHT
	roof_mesh.radial_segments = 16
	roof.mesh = roof_mesh
	roof.material_override = _flat_material(ROOF_COLOR)
	roof.position = Vector3(0.0, TORRE_BODY_HEIGHT + TORRE_ROOF_HEIGHT * 0.5, 0.0)
	root.add_child(roof)

	# 5 emissive windows spiraling up the body — golden-angle spacing so they
	# don't stack in a single vertical line.
	var window_mat := _emissive_material(EMISSIVE_GOLD, 3.5)
	for i in TORRE_WINDOW_COUNT:
		var angle_rad: float = i * deg_to_rad(137.5)
		var height: float = lerpf(0.9, TORRE_BODY_HEIGHT - 0.6, float(i) / float(TORRE_WINDOW_COUNT - 1))
		var window := _surface_box(TORRE_BODY_RADIUS, angle_rad, height, Vector3(0.32, 0.42, 0.08), window_mat)
		root.add_child(window)

	var light := OmniLight3D.new()
	light.name = "TorreGlow"
	light.light_color = EMISSIVE_GOLD
	light.light_energy = 2.6
	light.omni_range = 9.0
	light.position = Vector3(0.0, TORRE_BODY_HEIGHT + 0.3, 0.0)
	root.add_child(light)

	root.add_child(_make_label("Torre", TORRE_BODY_HEIGHT + TORRE_ROOF_HEIGHT + 1.2))
	return root


# ---------------------------------------------------------------------------
# Shrine — dais + floating rotating crystal, purple glow
# ---------------------------------------------------------------------------

const SHRINE_DAIS_RADIUS: float = 1.6
const SHRINE_DAIS_HEIGHT: float = 0.6
const SHRINE_CRYSTAL_HEIGHT: float = 1.5
const SHRINE_CRYSTAL_SIZE: float = 0.55

static func build_shrine() -> Node3D:
	var root := Node3D.new()
	root.name = "Shrine"
	root.position = BLSpots.position_of("shrine")

	var dais := MeshInstance3D.new()
	var dais_mesh := CylinderMesh.new()
	dais_mesh.top_radius = SHRINE_DAIS_RADIUS
	dais_mesh.bottom_radius = SHRINE_DAIS_RADIUS * 1.1
	dais_mesh.height = SHRINE_DAIS_HEIGHT
	dais_mesh.radial_segments = 24
	dais.mesh = dais_mesh
	dais.material_override = _flat_material(GOLD_TRIM_COLOR)
	dais.position = Vector3(0.0, SHRINE_DAIS_HEIGHT * 0.5, 0.0)
	root.add_child(dais)

	# Crystal floats above the dais and rotates slowly (BLRotator handles the
	# _process spin; the octahedron mesh itself is a static ArrayMesh).
	var crystal_holder := BLRotator.new()
	crystal_holder.name = "CrystalHolder"
	crystal_holder.degrees_per_second = 26.0
	crystal_holder.position = Vector3(0.0, SHRINE_DAIS_HEIGHT + SHRINE_CRYSTAL_HEIGHT, 0.0)
	root.add_child(crystal_holder)

	var crystal := MeshInstance3D.new()
	crystal.name = "Crystal"
	crystal.mesh = _octahedron_mesh(SHRINE_CRYSTAL_SIZE)
	crystal.material_override = _emissive_material(EMISSIVE_PURPLE, 4.0, 0.5)
	crystal_holder.add_child(crystal)

	var light := OmniLight3D.new()
	light.name = "ShrineGlow"
	light.light_color = EMISSIVE_PURPLE
	light.light_energy = 2.4
	light.omni_range = 7.0
	light.position = crystal_holder.position
	root.add_child(light)

	root.add_child(_make_label("Santuario", SHRINE_DAIS_HEIGHT + SHRINE_CRYSTAL_HEIGHT + 1.1))
	return root


# ---------------------------------------------------------------------------
# Posada (inn) — box body + gable roof, one warm window
# ---------------------------------------------------------------------------

const POSADA_SIZE: Vector3 = Vector3(4.0, 3.0, 3.2)
const POSADA_ROOF_HEIGHT: float = 1.8

static func build_posada() -> Node3D:
	var root := Node3D.new()
	root.name = "Posada"
	root.position = BLSpots.position_of("posada")

	var body := MeshInstance3D.new()
	var body_mesh := BoxMesh.new()
	body_mesh.size = POSADA_SIZE
	body.mesh = body_mesh
	body.material_override = _flat_material(WOOD_COLOR)
	body.position = Vector3(0.0, POSADA_SIZE.y * 0.5, 0.0)
	root.add_child(body)

	# PrismMesh's default left_to_right (0.5) centers the top edge, giving a
	# natural gable/tent cross-section — a cheap "roof" primitive.
	var roof := MeshInstance3D.new()
	var roof_mesh := PrismMesh.new()
	roof_mesh.size = Vector3(POSADA_SIZE.x + 0.4, POSADA_ROOF_HEIGHT, POSADA_SIZE.z + 0.4)
	roof.mesh = roof_mesh
	roof.material_override = _flat_material(ROOF_COLOR)
	roof.position = Vector3(0.0, POSADA_SIZE.y + POSADA_ROOF_HEIGHT * 0.5, 0.0)
	root.add_child(roof)

	var window := MeshInstance3D.new()
	var window_mesh := BoxMesh.new()
	window_mesh.size = Vector3(0.6, 0.7, 0.08)
	window.mesh = window_mesh
	window.material_override = _emissive_material(EMISSIVE_WARM, 3.0)
	window.position = Vector3(0.0, POSADA_SIZE.y * 0.55, POSADA_SIZE.z * 0.5 + 0.02)
	root.add_child(window)

	var light := OmniLight3D.new()
	light.name = "PosadaGlow"
	light.light_color = EMISSIVE_WARM
	light.light_energy = 1.8
	light.omni_range = 6.0
	light.position = window.position + Vector3(0.0, 0.0, 0.4)
	root.add_child(light)

	root.add_child(_make_label("Posada", POSADA_SIZE.y + POSADA_ROOF_HEIGHT + 1.0))
	return root


# ---------------------------------------------------------------------------
# Campo de Entrenamiento — widest footprint: pad + fence ring + dummies
# ---------------------------------------------------------------------------

const CAMPO_PAD_RADIUS: float = 4.5
const CAMPO_FENCE_RADIUS: float = 4.3
const CAMPO_FENCE_POST_COUNT: int = 10
const CAMPO_DUMMY_OFFSETS: Array[Vector3] = [
	Vector3(-1.8, 0.0, -1.5),
	Vector3(1.8, 0.0, -1.5),
	Vector3(0.0, 0.0, 1.9),
]

static func build_campo() -> Node3D:
	var root := Node3D.new()
	root.name = "CampoDeEntrenamiento"
	root.position = BLSpots.position_of("campo")

	var pad := MeshInstance3D.new()
	var pad_mesh := CylinderMesh.new()
	pad_mesh.top_radius = CAMPO_PAD_RADIUS
	pad_mesh.bottom_radius = CAMPO_PAD_RADIUS
	pad_mesh.height = 0.12
	pad_mesh.radial_segments = 32
	pad.mesh = pad_mesh
	pad.material_override = _flat_material(DIRT_COLOR)
	pad.position = Vector3(0.0, 0.06, 0.0)
	root.add_child(pad)

	var post_mat := _flat_material(WOOD_COLOR)
	for i in CAMPO_FENCE_POST_COUNT:
		var angle: float = i * TAU / CAMPO_FENCE_POST_COUNT
		var post := MeshInstance3D.new()
		var post_mesh := CylinderMesh.new()
		post_mesh.top_radius = 0.07
		post_mesh.bottom_radius = 0.08
		post_mesh.height = 1.0
		post.mesh = post_mesh
		post.material_override = post_mat
		post.position = Vector3(cos(angle) * CAMPO_FENCE_RADIUS, 0.5, sin(angle) * CAMPO_FENCE_RADIUS)
		root.add_child(post)

	for offset in CAMPO_DUMMY_OFFSETS:
		root.add_child(_build_training_dummy(offset))

	root.add_child(_make_label("Campo de Entrenamiento", 2.6))
	return root


static func _build_training_dummy(offset: Vector3) -> Node3D:
	var dummy := Node3D.new()
	dummy.name = "TrainingDummy"
	dummy.position = offset

	var wood_mat := _flat_material(WOOD_COLOR)

	var post := MeshInstance3D.new()
	var post_mesh := CylinderMesh.new()
	post_mesh.top_radius = 0.09
	post_mesh.bottom_radius = 0.10
	post_mesh.height = 1.3
	post.mesh = post_mesh
	post.material_override = wood_mat
	post.position = Vector3(0.0, 0.65, 0.0)
	dummy.add_child(post)

	var crossbar := MeshInstance3D.new()
	var crossbar_mesh := BoxMesh.new()
	crossbar_mesh.size = Vector3(0.9, 0.12, 0.12)
	crossbar.mesh = crossbar_mesh
	crossbar.material_override = wood_mat
	crossbar.position = Vector3(0.0, 0.95, 0.0)
	dummy.add_child(crossbar)

	var head := MeshInstance3D.new()
	var head_mesh := SphereMesh.new()
	head_mesh.radius = 0.22
	head_mesh.height = 0.44
	head.mesh = head_mesh
	head.material_override = _flat_material(Color(0.72, 0.62, 0.48))
	head.position = Vector3(0.0, 1.42, 0.0)
	dummy.add_child(head)

	return dummy


# ---------------------------------------------------------------------------
# Cámara de los Ecos (Fusión) — enclosed windowless chamber, exterior only
# ---------------------------------------------------------------------------

const FUSION_RADIUS: float = 1.6
const FUSION_HEIGHT: float = 2.4
const FUSION_CAP_HEIGHT: float = 0.5

static func build_fusion() -> Node3D:
	var root := Node3D.new()
	root.name = "CamaraDeLosEcos"
	root.position = BLSpots.position_of("fusion")

	var body := MeshInstance3D.new()
	var body_mesh := CylinderMesh.new()
	body_mesh.top_radius = FUSION_RADIUS
	body_mesh.bottom_radius = FUSION_RADIUS
	body_mesh.height = FUSION_HEIGHT
	body_mesh.radial_segments = 20
	body.mesh = body_mesh
	body.material_override = _flat_material(DARK_STONE_COLOR)
	body.position = Vector3(0.0, FUSION_HEIGHT * 0.5, 0.0)
	root.add_child(body)

	var cap := MeshInstance3D.new()
	var cap_mesh := CylinderMesh.new()
	cap_mesh.top_radius = FUSION_RADIUS * 0.8
	cap_mesh.bottom_radius = FUSION_RADIUS * 1.03
	cap_mesh.height = FUSION_CAP_HEIGHT
	cap_mesh.radial_segments = 20
	cap.mesh = cap_mesh
	cap.material_override = _flat_material(DARK_STONE_COLOR)
	cap.position = Vector3(0.0, FUSION_HEIGHT + FUSION_CAP_HEIGHT * 0.5, 0.0)
	root.add_child(cap)

	# Subtle cool emissive trim ring near the top — the chamber's only
	# distinguishing detail (windowless per spec, exterior-only, no
	# interactive logic wired to it this milestone).
	var trim := MeshInstance3D.new()
	var trim_mesh := TorusMesh.new()
	trim_mesh.inner_radius = FUSION_RADIUS * 0.94
	trim_mesh.outer_radius = FUSION_RADIUS * 1.06
	trim.mesh = trim_mesh
	trim.material_override = _emissive_material(EMISSIVE_COOL, 2.2, 0.3)
	trim.position = Vector3(0.0, FUSION_HEIGHT - 0.35, 0.0)
	root.add_child(trim)

	var light := OmniLight3D.new()
	light.name = "FusionGlow"
	light.light_color = EMISSIVE_COOL
	light.light_energy = 0.9
	light.omni_range = 5.0
	light.position = trim.position
	root.add_child(light)

	root.add_child(_make_label("Cámara de los Ecos", FUSION_HEIGHT + FUSION_CAP_HEIGHT + 1.1))
	return root


# ---------------------------------------------------------------------------
# Plaza — campfire: radiating logs + emissive flame + flickering warm light
# ---------------------------------------------------------------------------

const PLAZA_LOG_COUNT: int = 6
const PLAZA_LOG_RADIUS: float = 0.13
const PLAZA_LOG_LENGTH: float = 1.3

static func build_plaza() -> Node3D:
	var root := Node3D.new()
	root.name = "Plaza"
	root.position = BLSpots.position_of("plaza")

	var log_mat := _flat_material(WOOD_COLOR)
	for i in PLAZA_LOG_COUNT:
		var angle: float = i * TAU / PLAZA_LOG_COUNT
		# "fire_log", not "log" — a plain "log" local shadows GDScript's
		# built-in log() math function.
		var fire_log := MeshInstance3D.new()
		var log_mesh := CylinderMesh.new()
		log_mesh.top_radius = PLAZA_LOG_RADIUS
		log_mesh.bottom_radius = PLAZA_LOG_RADIUS
		log_mesh.height = PLAZA_LOG_LENGTH
		fire_log.mesh = log_mesh
		fire_log.material_override = log_mat
		# Lay the cylinder on its side (roll 90deg) then yaw so the logs
		# radiate outward from the fire's center, crossing over each other
		# like a real log pile.
		fire_log.rotation = Vector3(0.0, angle, PI * 0.5)
		fire_log.position = Vector3(0.0, PLAZA_LOG_RADIUS + 0.05, 0.0)
		root.add_child(fire_log)

	var flame_base := MeshInstance3D.new()
	var flame_base_mesh := CylinderMesh.new()
	flame_base_mesh.top_radius = 0.08
	flame_base_mesh.bottom_radius = 0.35
	flame_base_mesh.height = 0.75
	flame_base.mesh = flame_base_mesh
	flame_base.material_override = _emissive_material(Color(0.95, 0.30, 0.08), 3.5, 0.6)
	flame_base.position = Vector3(0.0, 0.55, 0.0)
	root.add_child(flame_base)

	var flame_tip := MeshInstance3D.new()
	var flame_tip_mesh := CylinderMesh.new()
	flame_tip_mesh.top_radius = 0.02
	flame_tip_mesh.bottom_radius = 0.18
	flame_tip_mesh.height = 0.5
	flame_tip.mesh = flame_tip_mesh
	flame_tip.material_override = _emissive_material(EMISSIVE_GOLD, 4.0, 0.7)
	flame_tip.position = Vector3(0.0, 1.0, 0.0)
	root.add_child(flame_tip)

	var light := BLFlickerLight.new()
	light.name = "CampfireGlow"
	light.light_color = EMISSIVE_WARM
	light.base_energy = 2.6
	light.omni_range = 8.0
	light.position = Vector3(0.0, 0.9, 0.0)
	root.add_child(light)

	root.add_child(_make_label("Plaza", 2.4))
	return root


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

static func _flat_material(color: Color, roughness: float = 0.85) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = roughness
	mat.metallic = 0.0
	return mat


## `base_dim` keeps the daylight albedo from reading as pure-white/blown-out
## while `emission`/`energy` make the surface unshaded-bright and clearly
## glowing at night (matches every structure's "emissive elements should
## read at night" requirement).
static func _emissive_material(color: Color, energy: float = 3.0, base_dim: float = 0.35) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color * base_dim
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = energy
	mat.roughness = 0.6
	return mat


static func _make_label(text: String, height: float) -> Label3D:
	var label := Label3D.new()
	label.text = text
	label.position = Vector3(0.0, height, 0.0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 40
	label.outline_size = 10
	label.modulate = Color(1.0, 1.0, 1.0)
	label.outline_modulate = Color(0.0, 0.0, 0.0, 0.85)
	return label


## Places a small box on the surface of a vertical cylinder at `angle_rad`
## (around Y) and `height`, oriented so its thin local-Z axis points radially
## outward — used for the Torre's spiraling windows.
static func _surface_box(radius: float, angle_rad: float, height: float, size: Vector3, mat: Material) -> MeshInstance3D:
	var box := BoxMesh.new()
	box.size = size

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = box
	mesh_instance.material_override = mat
	mesh_instance.position = Vector3(cos(angle_rad) * radius, height, sin(angle_rad) * radius)
	mesh_instance.rotation.y = PI * 0.5 - angle_rad
	return mesh_instance


## Godot has no built-in octahedron primitive (per the spec's Structures
## table note) — approximated with a hand-built 6-vertex/8-face ArrayMesh
## via SurfaceTool. Used for the Shrine's crystal.
static func _octahedron_mesh(size: float) -> ArrayMesh:
	var top := Vector3(0.0, size, 0.0)
	var bottom := Vector3(0.0, -size, 0.0)
	var px := Vector3(size, 0.0, 0.0)
	var nx := Vector3(-size, 0.0, 0.0)
	var pz := Vector3(0.0, 0.0, size)
	var nz := Vector3(0.0, 0.0, -size)

	var faces: Array[Array] = [
		[top, px, pz], [top, pz, nx], [top, nx, nz], [top, nz, px],
		[bottom, pz, px], [bottom, nx, pz], [bottom, nz, nx], [bottom, px, nz],
	]

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for face in faces:
		for vertex in face:
			st.add_vertex(vertex)
	st.generate_normals()
	return st.commit()
