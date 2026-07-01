extends Control

## BetaLife Dev Panel — generates and displays a Hero using the already-ported
## engine (seeder -> archetypes -> axes -> name_generator -> gacha). First
## visible proof-of-life for the TS -> GDScript port; not a final UI.

var _seed_counter: int = 0

var _seed_label: Label
var _name_label: Label
var _stars_label: Label
var _archetype_label: Label
var _backstory_label: RichTextLabel


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "top", "right", "bottom"]:
		margin.add_theme_constant_override("margin_%s" % side, 32)
	add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 16)
	margin.add_child(vbox)

	var title := Label.new()
	title.text = "BetaLife — Hero Generator (Dev Panel)"
	title.add_theme_font_size_override("font_size", 28)
	vbox.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Exercises the ported engine: seeder -> archetypes -> axes -> name_generator -> gacha"
	subtitle.modulate = Color(0.7, 0.7, 0.7)
	vbox.add_child(subtitle)

	var button := Button.new()
	button.text = "Generate Hero"
	button.custom_minimum_size = Vector2(200, 48)
	button.pressed.connect(_on_generate_pressed)
	vbox.add_child(button)

	_seed_label = Label.new()
	_seed_label.modulate = Color(0.6, 0.6, 0.6)
	vbox.add_child(_seed_label)

	var panel := PanelContainer.new()
	vbox.add_child(panel)

	var result_box := VBoxContainer.new()
	result_box.add_theme_constant_override("separation", 8)
	panel.add_child(result_box)

	_name_label = _make_result_label(result_box)
	_stars_label = _make_result_label(result_box)
	_archetype_label = _make_result_label(result_box)

	_backstory_label = RichTextLabel.new()
	_backstory_label.fit_content = true
	_backstory_label.custom_minimum_size = Vector2(600, 60)
	_backstory_label.bbcode_enabled = false
	result_box.add_child(_backstory_label)

	_on_generate_pressed()

	# Headless-friendly self-verification: set BL_DEV_SCREENSHOT to a file path
	# to have this scene render one frame, save a PNG, and quit — lets an agent
	# (or CI) confirm a dev scene actually renders without OS-level screen capture.
	var screenshot_path: String = OS.get_environment("BL_DEV_SCREENSHOT")
	if screenshot_path != "":
		await get_tree().process_frame
		await get_tree().process_frame
		get_viewport().get_texture().get_image().save_png(screenshot_path)
		get_tree().quit()


func _make_result_label(parent: Node) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", 18)
	parent.add_child(l)
	return l


func _on_generate_pressed() -> void:
	_seed_counter += 1
	var seed_string: String = "dev-panel-%d-%d" % [Time.get_ticks_usec(), _seed_counter]
	var seeder: BLSeeder = BLSeeder.new(seed_string)

	var archetype: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(seeder)
	var axes: Dictionary = BLAxes.generate_axes(seeder, archetype)
	var traits: Array[String] = BLAxes.read_emergent_traits(axes)
	var culture: String = BLNameGenerator.generate_culture(seeder)
	var hero_name: String = BLNameGenerator.generate_name(seeder, culture, axes)
	var difficulty: int = BLGacha.roll_difficulty(seeder)
	var stars: int = BLGacha.roll_stars(seeder, difficulty)
	var fragment: String = String(seeder.branch("fragment").next_choice(archetype.fragments))

	_seed_label.text = "Seed: %s   |   World difficulty: %d/1000" % [seed_string, difficulty]
	_name_label.text = "%s  (%s culture)" % [hero_name, culture]
	_stars_label.text = "Rating: %s" % _star_string(stars)

	var traits_suffix: String = ""
	if not traits.is_empty():
		traits_suffix = "  (traits: %s)" % ", ".join(traits)
	_archetype_label.text = "Archetype: %s%s" % [archetype.id, traits_suffix]

	_backstory_label.text = fragment


func _star_string(stars: int) -> String:
	return "★".repeat(stars) + "☆".repeat(5 - stars)
