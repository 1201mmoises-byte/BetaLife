extends Control

## BetaLife Dev Panel — generates and displays a Hero using the already-ported
## engine, via the shared BLHeroFactory pipeline (seeder -> archetypes ->
## axes -> name_generator -> gacha -> role). First visible proof-of-life for
## the TS -> GDScript port; not a final UI.
##
## Phase 2C adds two buttons: "Guardar héroe" adds the currently-generated
## hero to the Roster autoload, and "Entrar al Pueblo" changes scene to the
## village, where Roster heroes get spawned as hero figures. Generation logic
## itself now lives in scripts/engine/hero_factory.gd (BLHeroFactory) — this
## script only drives the UI and calls it, so this is the one generation path
## both the dev panel and the village share.

const VILLAGE_SCENE_PATH: String = "res://scenes/village/village_base.tscn"

var _seed_counter: int = 0
var _current_hero: Dictionary = {}

var _seed_label: Label
var _name_label: Label
var _stars_label: Label
var _archetype_label: Label
var _backstory_label: RichTextLabel
var _save_hero_button: Button


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
	subtitle.add_theme_color_override("font_color", Color(0.745, 0.686, 0.902, 0.75))
	vbox.add_child(subtitle)

	var button_row := HBoxContainer.new()
	button_row.add_theme_constant_override("separation", 12)
	vbox.add_child(button_row)

	var generate_button := Button.new()
	generate_button.text = "Generate Hero"
	generate_button.custom_minimum_size = Vector2(200, 48)
	generate_button.pressed.connect(_on_generate_pressed)
	button_row.add_child(generate_button)

	_save_hero_button = Button.new()
	_save_hero_button.text = "Guardar héroe"
	_save_hero_button.custom_minimum_size = Vector2(200, 48)
	_save_hero_button.disabled = true
	_save_hero_button.pressed.connect(_on_save_hero_pressed)
	button_row.add_child(_save_hero_button)

	var enter_village_button := Button.new()
	enter_village_button.text = "Entrar al Pueblo"
	enter_village_button.custom_minimum_size = Vector2(200, 48)
	enter_village_button.pressed.connect(_on_enter_village_pressed)
	button_row.add_child(enter_village_button)

	_seed_label = Label.new()
	_seed_label.add_theme_color_override("font_color", Color(0.745, 0.686, 0.902, 0.55))
	vbox.add_child(_seed_label)

	var panel := PanelContainer.new()
	vbox.add_child(panel)

	var result_box := VBoxContainer.new()
	result_box.add_theme_constant_override("separation", 8)
	panel.add_child(result_box)

	_name_label = _make_result_label(result_box)
	_stars_label = _make_result_label(result_box)
	_stars_label.add_theme_color_override("font_color", Color(0.9412, 0.7529, 0.251, 1))
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
	_current_hero = BLHeroFactory.generate(seed_string)
	_save_hero_button.disabled = false

	_seed_label.text = "Seed: %s   |   World difficulty: %d/1000" % [seed_string, _current_hero["difficulty"]]
	_name_label.text = "%s  (%s culture)" % [_current_hero["name"], _current_hero["culture"]]
	_stars_label.text = "Rating: %s" % _star_string(_current_hero["stars"])

	var traits: Array = _current_hero["traits"]
	var traits_suffix: String = ""
	if not traits.is_empty():
		traits_suffix = "  (traits: %s)" % ", ".join(traits)
	_archetype_label.text = "Archetype: %s%s   |   Role: %s" % [_current_hero["archetype_id"], traits_suffix, _current_hero["role"]]

	_backstory_label.text = _current_hero["fragment"]


## Saves the currently-displayed hero to the Roster exactly once: the id
## guard skips heroes already saved (hero ids are their seed strings, which
## must stay unique in the roster — see hero_factory.gd), and the button is
## re-disabled after a save so it can't even be re-clicked until the next
## Generate produces a fresh hero (belt AND suspenders, per review).
func _on_save_hero_pressed() -> void:
	if _current_hero.is_empty() or Roster.has_hero(String(_current_hero["id"])):
		_save_hero_button.disabled = true
		return
	Roster.add_hero(_current_hero)
	_save_hero_button.disabled = true


func _on_enter_village_pressed() -> void:
	get_tree().change_scene_to_file(VILLAGE_SCENE_PATH)


func _star_string(stars: int) -> String:
	return "★".repeat(stars) + "☆".repeat(5 - stars)
