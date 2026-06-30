extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_raw_draws_match_golden_vectors() -> void:
	var seeds: Array = golden["seederDraws"].keys()
	for seed in seeds:
		var s := BLSeeder.new(seed)
		var expected_draws: Array = golden["seederDraws"][seed]["draws"]
		for i in expected_draws.size():
			assert_float(s.next()).is_equal_approx(float(expected_draws[i]), 0.0000001)

func test_branch_draws_match_golden_vectors() -> void:
	var seeds: Array = golden["seederDraws"].keys()
	for seed in seeds:
		var s := BLSeeder.new(seed)
		for i in 10:
			s.next() # consume the same 10 draws the export script consumed before branching
		var b := s.branch("axes")
		var expected_branch: Array = golden["seederDraws"][seed]["branchDraws"]
		for i in expected_branch.size():
			assert_float(b.next()).is_equal_approx(float(expected_branch[i]), 0.0000001)

func test_helpers_match_golden_vectors() -> void:
	var seeds: Array = golden["seederHelpers"].keys()
	for seed in seeds:
		var s := BLSeeder.new(seed)
		var expected: Dictionary = golden["seederHelpers"][seed]
		assert_float(s.next_float(10.0, 20.0)).is_equal_approx(float(expected["nextFloatRange"]), 0.0000001)
	for seed in seeds:
		var s := BLSeeder.new(seed)
		s.next_float(10.0, 20.0) # match the draw order the export script used
		var expected: Dictionary = golden["seederHelpers"][seed]
		assert_int(s.next_int(0, 99)).is_equal(int(expected["nextInt"]))
	for seed in seeds:
		var s := BLSeeder.new(seed)
		s.next_float(10.0, 20.0)
		s.next_int(0, 99)
		var expected: Dictionary = golden["seederHelpers"][seed]
		assert_str(str(s.next_choice(["a", "b", "c", "d", "e"]))).is_equal(str(expected["nextChoice"]))

func test_empty_seed_starts_from_fnv_offset_basis() -> void:
	# Regression guard for the hashString edge case (h never XORed with anything).
	var s := BLSeeder.new("")
	var expected_draws: Array = golden["seederDraws"][""]["draws"]
	for i in expected_draws.size():
		assert_float(s.next()).is_equal_approx(float(expected_draws[i]), 0.0000001)
