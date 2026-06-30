extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_axis_keys_order_matches_ts() -> void:
	var expected: Array[String] = [
		"caution", "passivity", "submission", "warmth", "trust",
		"altruism", "sociability", "integrity", "loyalty", "optimism",
		"discipline", "curiosity", "confidence", "forgiveness",
	]
	assert_array(BLAxes.AXIS_KEYS).is_equal(expected)

func test_generate_axes_without_archetype_matches_golden_vectors() -> void:
	var seeds: Array = golden["axes"].keys()
	for seed in seeds:
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var expected: Dictionary = golden["axes"][seed]["noArchetype"]
		for key in BLAxes.AXIS_KEYS:
			assert_float(axes[key]).is_equal_approx(float(expected[key]), 0.00001)

func test_read_emergent_traits_matches_golden_vectors() -> void:
	var seeds: Array = golden["axes"].keys()
	for seed in seeds:
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var traits: Array[String] = BLAxes.read_emergent_traits(axes)
		var expected: Array = golden["axes"][seed]["emergentTraits"]
		assert_array(traits).is_equal(expected)

func test_emergent_trait_thresholds() -> void:
	var axes := {
		"caution": 0.5, "passivity": 0.5, "submission": 0.5, "warmth": 0.5, "trust": 0.5,
		"altruism": 0.5, "sociability": 0.5, "integrity": 0.8, "loyalty": 0.8, "optimism": 0.5,
		"discipline": 0.5, "curiosity": 0.5, "confidence": 0.5, "forgiveness": 0.5,
	}
	axes["altruism"] = 0.7
	assert_array(BLAxes.read_emergent_traits(axes)).contains(["honor"])
