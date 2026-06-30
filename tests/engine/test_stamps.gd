extends GdUnitTestSuite

var golden: Dictionary

func before() -> void:
	golden = GoldenVectors.load_fixture()

func test_band_of_matches_golden_vectors() -> void:
	var samples: Array = golden["stamps"]["bandOfSamples"]
	for sample in samples:
		assert_int(BLStamps.band_of(float(sample["value"]))).is_equal(int(sample["band"]))

func test_nearest_band_matches_golden_vectors() -> void:
	var samples: Array = golden["stamps"]["nearestBandSamples"]
	for sample in samples:
		assert_float(BLStamps.nearest_band(float(sample["value"]))).is_equal_approx(float(sample["nearest"]), 0.00001)

func test_soft_ceiling_matches_golden_vectors() -> void:
	var samples: Array = golden["stamps"]["softCeilingSamples"]
	for sample in samples:
		var result: float = BLStamps.soft_ceiling(float(sample["value"]), float(sample["delta"]))
		assert_float(result).is_equal_approx(float(sample["result"]), 0.00001)

func test_seal_if_band_crossed_matches_golden_vectors() -> void:
	var crossed: Dictionary = golden["stamps"]["growthStamp"]
	var stamp: BLStamps.Stamp = BLStamps.seal_if_band_crossed("caution", 0.2, 0.4, 123)
	assert_str(stamp.kind).is_equal(String(crossed["kind"]))
	assert_str(stamp.axis_key).is_equal(String(crossed["axisKey"]))
	assert_float(stamp.band_value).is_equal_approx(float(crossed["bandValue"]), 0.00001)
	assert_int(stamp.sealed_at).is_equal(int(crossed["sealedAt"]))

	var not_crossed: BLStamps.Stamp = BLStamps.seal_if_band_crossed("caution", 0.2, 0.24, 123)
	assert_object(not_crossed).is_null()

func test_seal_birth_stamp_matches_golden_vectors() -> void:
	var seeds: Array = golden["birthStamps"].keys()
	for seed in seeds:
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var arch: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(BLSeeder.new(seed))

		var with_arch: BLStamps.Stamp = BLStamps.seal_birth_stamp(axes, arch, 0)
		var expected_with: Dictionary = golden["birthStamps"][seed]["withArchetype"]
		assert_str(with_arch.axis_key).is_equal(String(expected_with["axisKey"]))
		assert_float(with_arch.band_value).is_equal_approx(float(expected_with["bandValue"]), 0.00001)

		var without_arch: BLStamps.Stamp = BLStamps.seal_birth_stamp(axes, null, 0)
		var expected_without: Dictionary = golden["birthStamps"][seed]["withoutArchetype"]
		assert_str(without_arch.axis_key).is_equal(String(expected_without["axisKey"]))
		assert_float(without_arch.band_value).is_equal_approx(float(expected_without["bandValue"]), 0.00001)
