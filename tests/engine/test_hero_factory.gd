extends GdUnitTestSuite

## Covers BLHeroFactory (scripts/engine/hero_factory.gd) — the shared hero-
## generation pipeline extracted from scripts/dev/dev_panel.gd's original
## inline seed -> BLSeeder -> pick_archetype -> generate_axes ->
## read_emergent_traits -> generate_culture/generate_name ->
## roll_difficulty/roll_stars -> fragment sequence, plus the new role
## derivation this phase adds.

const GOLDEN_SEED_A: String = "phase2c-golden-a"
const GOLDEN_SEED_B: String = "phase2c-golden-b"


func test_generate_is_deterministic_for_the_same_seed() -> void:
	var first: Dictionary = BLHeroFactory.generate("determinism-check-seed")
	var second: Dictionary = BLHeroFactory.generate("determinism-check-seed")
	assert_dict(first).is_equal(second)


func test_generate_returns_the_canonical_record_shape() -> void:
	var hero: Dictionary = BLHeroFactory.generate("shape-check-seed")
	var expected_keys: Array[String] = [
		"id", "seed", "name", "culture", "archetype_id", "stars",
		"difficulty", "axes", "traits", "fragment", "role",
	]
	for key in expected_keys:
		assert_bool(hero.has(key)).is_true()

	assert_str(hero["id"]).is_not_empty()
	assert_str(hero["seed"]).is_equal("shape-check-seed")
	assert_str(hero["name"]).is_not_empty()
	assert_str(hero["culture"]).is_not_empty()
	assert_str(hero["archetype_id"]).is_not_empty()
	assert_int(hero["stars"]).is_between(1, 5)
	assert_int(hero["difficulty"]).is_between(1, 1000)
	assert_bool(hero["axes"] is Dictionary).is_true()
	assert_bool(hero["traits"] is Array).is_true()
	assert_str(hero["fragment"]).is_not_empty()


func test_generate_role_is_always_one_of_role_vis_keys() -> void:
	for i in 20:
		var hero: Dictionary = BLHeroFactory.generate("role-sweep-seed-%d" % i)
		assert_array(BLHeroFactory.ROLE_VIS.keys()).contains([hero["role"]])


func test_generate_role_derivation_is_deterministic_per_seed() -> void:
	var first: Dictionary = BLHeroFactory.generate("role-determinism-seed")
	var second: Dictionary = BLHeroFactory.generate("role-determinism-seed")
	assert_str(first["role"]).is_equal(second["role"])


## Golden expectations captured at implementation time by actually running
## BLHeroFactory.generate() for these two fixed seeds (see the report for
## the capture method) — pins name/stars/archetype/difficulty/culture/role
## so a future refactor can't silently change generation output.
func test_generate_matches_golden_expectations_seed_a() -> void:
	var hero: Dictionary = BLHeroFactory.generate(GOLDEN_SEED_A)
	assert_str(hero["name"]).is_equal("Zoraorasaro")
	assert_str(hero["culture"]).is_equal("africano")
	assert_str(hero["archetype_id"]).is_equal("imprudente")
	assert_int(hero["stars"]).is_equal(1)
	assert_int(hero["difficulty"]).is_equal(564)
	assert_str(hero["role"]).is_equal("rogue")


func test_generate_matches_golden_expectations_seed_b() -> void:
	var hero: Dictionary = BLHeroFactory.generate(GOLDEN_SEED_B)
	assert_str(hero["name"]).is_equal("runosros")
	assert_str(hero["culture"]).is_equal("hispano")
	assert_str(hero["archetype_id"]).is_equal("imprudente")
	assert_int(hero["stars"]).is_equal(1)
	assert_int(hero["difficulty"]).is_equal(487)
	assert_str(hero["role"]).is_equal("warrior")


## Verifies the dev-panel refactor (item 4 of the Phase 2C brief) didn't
## change generation: given the exact same seed string format/branch order
## the dev panel used pre-refactor, BLHeroFactory.generate() must produce
## the same name/stars/archetype/culture/difficulty/traits/fragment a
## hand-inlined equivalent of the original pipeline would have produced.
func test_generate_matches_hand_inlined_original_pipeline() -> void:
	var seed_string: String = "parity-check-seed"

	var seeder: BLSeeder = BLSeeder.new(seed_string)
	var archetype: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(seeder)
	var axes: Dictionary = BLAxes.generate_axes(seeder, archetype)
	var traits: Array[String] = BLAxes.read_emergent_traits(axes)
	var culture: String = BLNameGenerator.generate_culture(seeder)
	var hero_name: String = BLNameGenerator.generate_name(seeder, culture, axes)
	var difficulty: int = BLGacha.roll_difficulty(seeder)
	var stars: int = BLGacha.roll_stars(seeder, difficulty)
	var fragment: String = String(seeder.branch("fragment").next_choice(archetype.fragments))

	var hero: Dictionary = BLHeroFactory.generate(seed_string)

	assert_str(hero["name"]).is_equal(hero_name)
	assert_str(hero["culture"]).is_equal(culture)
	assert_str(hero["archetype_id"]).is_equal(archetype.id)
	assert_int(hero["stars"]).is_equal(stars)
	assert_int(hero["difficulty"]).is_equal(difficulty)
	assert_array(hero["traits"]).is_equal(traits)
	assert_str(hero["fragment"]).is_equal(fragment)
