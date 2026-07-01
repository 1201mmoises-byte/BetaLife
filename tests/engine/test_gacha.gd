extends GdUnitTestSuite

## Ports scripts/exportGoldenVectors.ts's "gacha" section — verifies BLGacha
## (port of src/engine/gacha.ts) is bit-identical to the TS engine.

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_roll_difficulty_matches_golden_vectors() -> void:
	var seeds: Array = golden["gacha"]["difficultyRolls"].keys()
	for seed in seeds:
		var rolled: int = BLGacha.roll_difficulty(BLSeeder.new(seed))
		assert_int(rolled).is_equal(int(golden["gacha"]["difficultyRolls"][seed]))

func test_star_probabilities_match_golden_vectors() -> void:
	for point in golden["gacha"]["starProbabilities"]:
		var difficulty: int = int(point["difficulty"])
		var roster_floor: int = int(point["rosterFloor"])
		var expected: Dictionary = point["probs"]
		var probs: Dictionary = BLGacha.star_probabilities(difficulty, roster_floor)
		for tier in [1, 2, 3, 4, 5]:
			assert_float(probs[tier]).is_equal_approx(float(expected[str(tier)]), 0.0000001)

func test_roll_stars_matches_golden_vectors() -> void:
	var star_rolls: Dictionary = golden["gacha"]["starRolls"]
	for seed in star_rolls.keys():
		for point_key in star_rolls[seed].keys():
			var parts: PackedStringArray = point_key.split(":")
			var difficulty: int = int(parts[0])
			var roster_floor: int = int(parts[1])
			var expected: int = int(star_rolls[seed][point_key])
			var rolled: int = BLGacha.roll_stars(BLSeeder.new(seed), difficulty, roster_floor)
			assert_int(rolled).is_equal(expected)

func test_star_probabilities_sum_to_one() -> void:
	for point in golden["gacha"]["starProbabilities"]:
		var probs: Dictionary = BLGacha.star_probabilities(int(point["difficulty"]), int(point["rosterFloor"]))
		var total: float = 0.0
		for tier in [1, 2, 3, 4, 5]:
			total += probs[tier]
		assert_float(total).is_equal_approx(1.0, 0.0000001)
