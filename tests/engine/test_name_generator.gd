extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_cultures_match_ts() -> void:
	var expected: Array[String] = ["hispano", "nordico", "celta", "eslavo", "greco", "africano", "asiatico"]
	assert_array(BLNameGenerator.CULTURES).is_equal(expected)

func test_generate_culture_matches_golden_vectors() -> void:
	var seeds: Array = golden["names"].keys()
	for seed in seeds:
		var culture: String = BLNameGenerator.generate_culture(BLSeeder.new(seed))
		assert_str(culture).is_equal(String(golden["names"][seed]["culture"]))

func test_generate_name_matches_golden_vectors_per_culture() -> void:
	var seeds: Array = golden["names"].keys()
	for seed in seeds:
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var expected_per_culture: Dictionary = golden["names"][seed]["perCulture"]
		for culture in BLNameGenerator.CULTURES:
			var name: String = BLNameGenerator.generate_name(BLSeeder.new(seed), culture, axes)
			assert_str(name).is_equal(String(expected_per_culture[culture]))

func test_name_namespace_size_matches_golden_vectors() -> void:
	assert_int(BLNameGenerator.name_namespace_size()).is_equal(int(golden["nameNamespaceSize"]))

func test_name_is_capitalized_only_on_first_letter() -> void:
	var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new("capitalization-check"))
	var name: String = BLNameGenerator.generate_name(BLSeeder.new("capitalization-check"), "hispano", axes)
	assert_str(name.substr(0, 1)).is_equal(name.substr(0, 1).to_upper())
	if name.length() > 1:
		assert_str(name.substr(1)).is_equal(name.substr(1).to_lower())
