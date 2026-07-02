class_name BLVillageBase
extends Node3D

## Village/Base 3D scene shell: ground discs, an orbit/pan/zoom camera, and a
## time_of_day-driven day/night sky (sun + moon + stars).
##
## This is Phase 2A's shell ONLY — no structures, heroes, fairy, or sim tick
## yet (those are Phase 2B/2C/4, per the village-base-3d-scene-design spec).
## Kept organized in clearly separated `_build_*` / `_apply_*` sections so
## those later phases can slot in (spawn structures/heroes into this same
## root, hook village_sim.gd into _process) without restructuring this file.

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

## Seconds of real time per in-world day. Town/pueblo always runs at 3x real
## time (1 real day = 3 in-world days) per the spec's Amendment 2 (canonical
## time model, user-corrected 2026-07-01) — NOT the obsolete previz 8640s
## value.
const DAY_LENGTH: float = 28800.0

const GRASS_RADIUS: float = 130.0
const FLOOR_RADIUS: float = 18.0
const GRASS_HEIGHT: float = 0.2
const FLOOR_HEIGHT: float = 0.05
const FLOOR_LIFT: float = 0.02 # gap above grass top, avoids z-fighting

const MAX_SUN_ELEVATION_DEG: float = 80.0
const TWILIGHT_BAND_DEG: float = 8.0
const SUN_AZIMUTH_DEG: float = 55.0
const MOON_AZIMUTH_DEG: float = 235.0 # opposite side of the sky from the sun

const SUN_MAX_ENERGY: float = 1.3
const MOON_MAX_ENERGY: float = 0.3
const DAY_AMBIENT_ENERGY: float = 1.0
const NIGHT_AMBIENT_ENERGY: float = 0.15

const DAY_SKY_TOP: Color = Color(0.25, 0.55, 0.95)
const DAY_SKY_HORIZON: Color = Color(0.75, 0.85, 0.95)
const DAY_GROUND_BOTTOM: Color = Color(0.30, 0.28, 0.25)
const NIGHT_SKY_TOP: Color = Color(0.02, 0.03, 0.10)
const NIGHT_SKY_HORIZON: Color = Color(0.05, 0.06, 0.16)
const NIGHT_GROUND_BOTTOM: Color = Color(0.01, 0.01, 0.03)

const STAR_COUNT: int = 1400
const STAR_DOME_RADIUS: float = 140.0
const STAR_SEED: int = 20260701 # fixed so the field is stable across runs

const CAMERA_PITCH_DEG: float = 19.0
const CAMERA_DISTANCE: float = 30.0
const CAMERA_TARGET_HEIGHT: float = 2.0
const CAMERA_INITIAL_ZOOM: float = 20.0
const ZOOM_MIN: float = 8.0
# NOTE: widened from the brief's illustrative "~60" ceiling. With an
# orthogonal camera at CAMERA_PITCH_DEG (19deg) looking at a GRASS_RADIUS
# (130) disc, the ground-plane hit distance at the top of the frustum is
# (size/2)/sin(pitch) -- independent of camera distance, a property of
# orthographic (parallel-ray) projection. That only exceeds the grass
# radius, exposing sky, once size > ~85. ZOOM_MAX is raised to 110 so a
# fully zoomed-out view can actually show sky/stars (verified via BL_ZOOM
# below); the gameplay default (CAMERA_INITIAL_ZOOM) stays close-in.
const ZOOM_MAX: float = 110.0
const ZOOM_STEP: float = 4.0
const ZOOM_LERP_SPEED: float = 8.0
const PAN_SPEED: float = 20.0
const ORBIT_SENSITIVITY_DEG_PER_PX: float = 0.25

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

## 0..1, 0 = midnight, 0.5 = noon. Advanced by delta / DAY_LENGTH unless
## BL_TOD forced it at startup (see _ready).
var time_of_day: float = 0.5

var _forced_time_of_day: bool = false

var _camera: Camera3D
var _sun: DirectionalLight3D
var _moon: DirectionalLight3D
var _world_environment: WorldEnvironment
var _sky_material: ProceduralSkyMaterial
var _stars: MultiMeshInstance3D
var _star_material: StandardMaterial3D
var _debug_label: Label3D

var _orbit_azimuth_deg: float = 0.0
var _camera_target: Vector3 = Vector3(0.0, CAMERA_TARGET_HEIGHT, 0.0)
var _zoom_target: float = CAMERA_INITIAL_ZOOM
var _is_orbiting: bool = false
var _is_panning: bool = false


# ---------------------------------------------------------------------------
# Pure static math — reachable headlessly (see tests/village/test_spots.gd)
# ---------------------------------------------------------------------------

## Sun elevation in degrees for a given time_of_day (0..1). Max (+MAX_SUN_
## ELEVATION_DEG) at noon (0.5), min (-MAX_SUN_ELEVATION_DEG) at midnight
## (0.0), symmetric around noon.
static func time_of_day_to_sun_elevation(tod: float) -> float:
	var wrapped: float = fposmod(tod, 1.0)
	return -cos(wrapped * TAU) * MAX_SUN_ELEVATION_DEG


## 0 (full day) .. 1 (full night), smoothstep-blended across a twilight band
## around the horizon so day/night transitions aren't a hard cut.
static func night_amount(tod: float) -> float:
	var elevation: float = time_of_day_to_sun_elevation(tod)
	return 1.0 - smoothstep(-TWILIGHT_BAND_DEG, TWILIGHT_BAND_DEG, elevation)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

func _ready() -> void:
	_build_ground()
	_build_sky()
	_build_lights()
	_build_stars()
	_build_camera()
	_build_debug_label()

	var forced_tod_str: String = OS.get_environment("BL_TOD")
	_forced_time_of_day = forced_tod_str != ""
	if _forced_time_of_day:
		time_of_day = clampf(forced_tod_str.to_float(), 0.0, 1.0)

	# Dev-only verification hook (mirrors BL_TOD): forces the orthographic
	# zoom before capture so BL_DEV_SCREENSHOT can confirm sky/star
	# rendering, which the default close-in gameplay zoom doesn't expose
	# (see the ZOOM_MAX note above).
	var forced_zoom_str: String = OS.get_environment("BL_ZOOM")
	if forced_zoom_str != "":
		_zoom_target = clampf(forced_zoom_str.to_float(), ZOOM_MIN, ZOOM_MAX)
		_camera_target = Vector3(0.0, CAMERA_TARGET_HEIGHT, 0.0) # ensure BL_ZOOM captures aren't affected by a panned target

	_apply_sky(time_of_day)
	_camera.size = _zoom_target
	_apply_camera_transform()

	# Headless self-verification: mirrors scripts/dev/dev_panel.gd's
	# BL_DEV_SCREENSHOT hook. BL_TOD (above) lets a caller force a specific
	# time of day before the capture, which is how day/night gets verified
	# without a human at the keyboard.
	var screenshot_path: String = OS.get_environment("BL_DEV_SCREENSHOT")
	if screenshot_path != "":
		await get_tree().process_frame
		await get_tree().process_frame
		get_viewport().get_texture().get_image().save_png(screenshot_path)
		get_tree().quit()


func _process(delta: float) -> void:
	if not _forced_time_of_day:
		time_of_day = fposmod(time_of_day + delta / DAY_LENGTH, 1.0)
	_apply_sky(time_of_day)

	_handle_continuous_pan(delta)
	_camera.size = lerpf(_camera.size, _zoom_target, clampf(delta * ZOOM_LERP_SPEED, 0.0, 1.0))
	_apply_camera_transform()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("village_zoom_in"):
		_adjust_zoom(-ZOOM_STEP)
	elif event.is_action_pressed("village_zoom_out"):
		_adjust_zoom(ZOOM_STEP)

	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_is_orbiting = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_RIGHT or mb.button_index == MOUSE_BUTTON_MIDDLE:
			_is_panning = mb.pressed
	elif event is InputEventMouseMotion:
		var mm: InputEventMouseMotion = event
		if _is_orbiting:
			_orbit_azimuth_deg = fposmod(_orbit_azimuth_deg - mm.relative.x * ORBIT_SENSITIVITY_DEG_PER_PX, 360.0)
		elif _is_panning:
			_pan_by_screen_delta(mm.relative)


# ---------------------------------------------------------------------------
# Ground
# ---------------------------------------------------------------------------

func _build_ground() -> void:
	var grass_mesh := CylinderMesh.new()
	grass_mesh.top_radius = GRASS_RADIUS
	grass_mesh.bottom_radius = GRASS_RADIUS
	grass_mesh.height = GRASS_HEIGHT
	grass_mesh.radial_segments = 64

	var grass := MeshInstance3D.new()
	grass.name = "GrassGround"
	grass.mesh = grass_mesh
	grass.position = Vector3(0.0, -GRASS_HEIGHT * 0.5, 0.0) # top face at y=0
	grass.material_override = _make_speckle_material(
		1337, Color(0.106, 0.302, 0.129), Color(0.180, 0.420, 0.192), 24.0, 1.0
	)
	add_child(grass)

	var floor_mesh := CylinderMesh.new()
	floor_mesh.top_radius = FLOOR_RADIUS
	floor_mesh.bottom_radius = FLOOR_RADIUS
	floor_mesh.height = FLOOR_HEIGHT
	floor_mesh.radial_segments = 48

	var village_floor := MeshInstance3D.new()
	village_floor.name = "VillageFloor"
	village_floor.mesh = floor_mesh
	village_floor.position = Vector3(0.0, FLOOR_LIFT + FLOOR_HEIGHT * 0.5, 0.0) # bottom at FLOOR_LIFT above grass top
	village_floor.material_override = _make_speckle_material(
		4242, Color(0.20, 0.20, 0.22), Color(0.30, 0.30, 0.33), 6.0, 0.85
	)
	add_child(village_floor)


## Bakes a cheap two-tone procedural speckle texture from FastNoiseLite
## (thresholded, not gradient, for a visible "speckle" rather than a smooth
## blur) and returns a material using it as the sole albedo source. Matches
## the previz's grassTexture()/canvas-speckle *intent*, not its exact
## pixel technique (see spec).
func _make_speckle_material(noise_seed: int, base_color: Color, speck_color: Color, uv_tile: float, roughness: float) -> StandardMaterial3D:
	var noise := FastNoiseLite.new()
	noise.seed = noise_seed
	noise.frequency = 0.35
	noise.fractal_octaves = 2

	var img: Image = noise.get_image(128, 128)
	img.convert(Image.FORMAT_RGBA8)
	for y in img.get_height():
		for x in img.get_width():
			var v: float = img.get_pixel(x, y).r
			img.set_pixel(x, y, base_color if v < 0.55 else speck_color)

	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color.WHITE # texture already carries final color
	mat.albedo_texture = ImageTexture.create_from_image(img)
	mat.uv1_scale = Vector3(uv_tile, uv_tile, 1.0)
	mat.roughness = roughness
	mat.metallic = 0.0
	return mat


# ---------------------------------------------------------------------------
# Sky, lights, stars
# ---------------------------------------------------------------------------

func _build_sky() -> void:
	_sky_material = ProceduralSkyMaterial.new()
	_sky_material.sky_top_color = DAY_SKY_TOP
	_sky_material.sky_horizon_color = DAY_SKY_HORIZON
	_sky_material.ground_bottom_color = DAY_GROUND_BOTTOM
	_sky_material.ground_horizon_color = DAY_SKY_HORIZON

	var sky := Sky.new()
	sky.sky_material = _sky_material

	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = DAY_AMBIENT_ENERGY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC

	_world_environment = WorldEnvironment.new()
	_world_environment.name = "Sky"
	_world_environment.environment = env
	add_child(_world_environment)


func _build_lights() -> void:
	_sun = DirectionalLight3D.new()
	_sun.name = "Sun"
	_sun.light_color = Color(1.0, 0.92, 0.78)
	_sun.shadow_enabled = true
	add_child(_sun)

	_moon = DirectionalLight3D.new()
	_moon.name = "Moon"
	_moon.light_color = Color(0.55, 0.65, 0.85)
	_moon.shadow_enabled = false
	add_child(_moon)


func _build_stars() -> void:
	var quad := QuadMesh.new()
	quad.size = Vector2(0.7, 0.7)

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = quad
	mm.instance_count = STAR_COUNT

	# Uniform sampling over the FULL sphere (not just the upper hemisphere):
	# with a fixed ~19deg-pitch orthogonal camera, only a narrow sliver of
	# sky is ever in frame at once (see the ZOOM_MAX note above), so a dome
	# restricted to the upper hemisphere leaves that sliver sparsely
	# populated. Full-sphere placement (points behind/below the camera are
	# simply never seen, same as a real skybox) with a high count keeps
	# whatever sliver IS visible reliably starry.
	var rng := RandomNumberGenerator.new()
	rng.seed = STAR_SEED
	for i in STAR_COUNT:
		var z: float = rng.randf_range(-1.0, 1.0)
		var theta: float = rng.randf_range(0.0, TAU)
		var r_xy: float = sqrt(max(0.0, 1.0 - z * z))
		var dir := Vector3(r_xy * cos(theta), z, r_xy * sin(theta))
		mm.set_instance_transform(i, Transform3D(Basis.IDENTITY, dir * STAR_DOME_RADIUS))

	_stars = MultiMeshInstance3D.new()
	_stars.name = "Stars"
	_stars.multimesh = mm

	_star_material = StandardMaterial3D.new()
	_star_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_star_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_star_material.albedo_color = Color(1.0, 1.0, 0.95, 0.0) # alpha driven by night_amount each frame
	_star_material.emission_enabled = true
	_star_material.emission = Color(1.0, 1.0, 0.95)
	_star_material.emission_energy_multiplier = 1.5
	_star_material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	_stars.material_override = _star_material

	add_child(_stars)


func _build_debug_label() -> void:
	_debug_label = Label3D.new()
	_debug_label.name = "DebugTimeLabel"
	_debug_label.position = Vector3(0.0, 4.0, 0.0)
	_debug_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_debug_label.font_size = 48
	_debug_label.outline_size = 8
	add_child(_debug_label)


## Applies time_of_day to sun/moon aim+energy, sky colors, ambient, and star
## opacity. Pure elevation math lives in the static funcs above; this just
## wires that math onto the scene's Nodes.
func _apply_sky(tod: float) -> void:
	var night: float = night_amount(tod)
	var day: float = 1.0 - night

	var sun_elev_deg: float = time_of_day_to_sun_elevation(tod)
	var moon_elev_deg: float = -sun_elev_deg

	_aim_light(_sun, sun_elev_deg, SUN_AZIMUTH_DEG)
	_aim_light(_moon, moon_elev_deg, MOON_AZIMUTH_DEG)

	_sun.light_energy = SUN_MAX_ENERGY * clampf(sun_elev_deg / MAX_SUN_ELEVATION_DEG, 0.0, 1.0)
	_moon.light_energy = MOON_MAX_ENERGY * clampf(moon_elev_deg / MAX_SUN_ELEVATION_DEG, 0.0, 1.0)

	_sky_material.sky_top_color = DAY_SKY_TOP.lerp(NIGHT_SKY_TOP, night)
	_sky_material.sky_horizon_color = DAY_SKY_HORIZON.lerp(NIGHT_SKY_HORIZON, night)
	_sky_material.ground_bottom_color = DAY_GROUND_BOTTOM.lerp(NIGHT_GROUND_BOTTOM, night)
	_sky_material.ground_horizon_color = DAY_SKY_HORIZON.lerp(NIGHT_SKY_HORIZON, night)

	_world_environment.environment.ambient_light_energy = lerpf(NIGHT_AMBIENT_ENERGY, DAY_AMBIENT_ENERGY, day)

	_star_material.albedo_color.a = night

	_debug_label.text = "Village Base — time_of_day: %.3f  (night_amount: %.2f)" % [tod, night]


func _aim_light(light: DirectionalLight3D, elevation_deg: float, azimuth_deg: float) -> void:
	var elev_rad: float = deg_to_rad(elevation_deg)
	var az_rad: float = deg_to_rad(azimuth_deg)
	var dir_to_light := Vector3(cos(elev_rad) * sin(az_rad), sin(elev_rad), cos(elev_rad) * cos(az_rad))
	light.global_position = dir_to_light * 50.0
	light.look_at(Vector3.ZERO, Vector3.UP)


# ---------------------------------------------------------------------------
# Camera rig: orthogonal, drag-to-orbit, wheel/action zoom, drag/WASD pan
# ---------------------------------------------------------------------------

func _build_camera() -> void:
	_camera = Camera3D.new()
	_camera.name = "VillageCamera"
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	_camera.size = _zoom_target
	_camera.near = 0.05
	_camera.far = 300.0
	_camera.current = true
	add_child(_camera)


func _adjust_zoom(amount: float) -> void:
	_zoom_target = clampf(_zoom_target + amount, ZOOM_MIN, ZOOM_MAX)


func _handle_continuous_pan(delta: float) -> void:
	var forward: Vector3 = _ground_plane_forward()
	var right: Vector3 = _ground_plane_right()

	var input_dir := Vector3.ZERO
	if Input.is_action_pressed("village_pan_up"):
		input_dir += forward
	if Input.is_action_pressed("village_pan_down"):
		input_dir -= forward
	if Input.is_action_pressed("village_pan_right"):
		input_dir += right
	if Input.is_action_pressed("village_pan_left"):
		input_dir -= right

	if input_dir != Vector3.ZERO:
		_camera_target += input_dir.normalized() * PAN_SPEED * delta
		_clamp_camera_target()


func _pan_by_screen_delta(rel: Vector2) -> void:
	var viewport_height: float = float(get_viewport().size.y)
	if viewport_height <= 0.0:
		return
	var world_units_per_pixel: float = _camera.size / viewport_height
	var forward: Vector3 = _ground_plane_forward()
	var right: Vector3 = _ground_plane_right()
	_camera_target += (-right * rel.x + forward * rel.y) * world_units_per_pixel
	_clamp_camera_target()


func _ground_plane_forward() -> Vector3:
	var forward: Vector3 = -_camera.global_transform.basis.z
	forward.y = 0.0
	return forward.normalized() if forward.length() > 0.0001 else Vector3.FORWARD


func _ground_plane_right() -> Vector3:
	var right: Vector3 = _camera.global_transform.basis.x
	right.y = 0.0
	return right.normalized() if right.length() > 0.0001 else Vector3.RIGHT


func _clamp_camera_target() -> void:
	var horizontal := Vector2(_camera_target.x, _camera_target.z)
	if horizontal.length() > GRASS_RADIUS:
		horizontal = horizontal.normalized() * GRASS_RADIUS
	_camera_target.x = horizontal.x
	_camera_target.z = horizontal.y


func _apply_camera_transform() -> void:
	var azimuth_rad: float = deg_to_rad(_orbit_azimuth_deg)
	var pitch_rad: float = deg_to_rad(CAMERA_PITCH_DEG)
	var horizontal_dist: float = CAMERA_DISTANCE * cos(pitch_rad)
	var height: float = CAMERA_DISTANCE * sin(pitch_rad)
	var offset := Vector3(sin(azimuth_rad), 0.0, cos(azimuth_rad)) * horizontal_dist
	offset.y = height
	_camera.position = _camera_target + offset
	_camera.look_at(_camera_target, Vector3.UP)
