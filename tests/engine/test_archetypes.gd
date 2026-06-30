extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_archetype_ids_match_ts() -> void:
	var expected_ids: Array[String] = ["honor", "imprudente", "calido", "rencoroso", "erudito", "difuso"]
	var actual_ids: Array[String] = []
	for a in BLArchetypes.get_archetypes():
		actual_ids.append(a.id)
	assert_array(actual_ids).is_equal(expected_ids)

func test_pick_archetype_matches_golden_vectors() -> void:
	var seeds: Array = golden["archetypePicks"].keys()
	for seed in seeds:
		var picked: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(BLSeeder.new(seed))
		assert_str(picked.id).is_equal(String(golden["archetypePicks"][seed]))

func test_generate_axes_with_each_archetype_matches_golden_vectors() -> void:
	var seeds: Array = golden["axes"].keys()
	for seed in seeds:
		for archetype in BLArchetypes.get_archetypes():
			var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed), archetype)
			var expected: Dictionary = golden["axes"][seed]["perArchetype"][archetype.id]
			for key in BLAxes.AXIS_KEYS:
				assert_float(axes[key]).is_equal_approx(float(expected[key]), 0.00001)

func test_signature_ranges_are_non_empty_for_named_archetypes() -> void:
	for a in BLArchetypes.get_archetypes():
		if a.id != "difuso":
			assert_bool(a.signature.is_empty()).is_false()
		else:
			assert_bool(a.signature.is_empty()).is_true()
