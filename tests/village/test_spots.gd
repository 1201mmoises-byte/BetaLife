extends GdUnitTestSuite

## Covers BLSpots (scripts/village/spots.gd) — named-position lookup for the
## village's 6 fixed structures — and the pure day/night math extracted onto
## BLVillageBase (scripts/village/village_base.gd), per the village-base-3d
## design spec's testing strategy.

const EXPECTED_POSITIONS: Dictionary = {
	"torre": Vector3(0, 0, -8),
	"shrine": Vector3(-6, 0, 3),
	"posada": Vector3(7, 0, -2),
	"campo": Vector3(6, 0, 5),
	"fusion": Vector3(-7, 0, -4),
	"plaza": Vector3(0, 0, 1),
}


func test_position_of_matches_spec_positions() -> void:
	for spot_name in EXPECTED_POSITIONS.keys():
		assert_vector(BLSpots.position_of(spot_name)).is_equal(EXPECTED_POSITIONS[spot_name])


func test_position_of_unknown_name_returns_zero_vector() -> void:
	assert_vector(BLSpots.position_of("not-a-real-spot")).is_equal(Vector3.ZERO)


func test_all_names_contains_exactly_the_six_spots() -> void:
	var names: Array[String] = BLSpots.all_names()
	assert_int(names.size()).is_equal(6)
	for spot_name in EXPECTED_POSITIONS.keys():
		assert_array(names).contains([spot_name])


func test_noon_sun_elevation_is_the_maximum() -> void:
	var noon: float = BLVillageBase.time_of_day_to_sun_elevation(0.5)
	for sample in [0.0, 0.1, 0.25, 0.4, 0.6, 0.75, 0.9, 0.999]:
		assert_float(noon).is_greater_equal(BLVillageBase.time_of_day_to_sun_elevation(sample))


func test_midnight_sun_elevation_is_the_minimum() -> void:
	var midnight: float = BLVillageBase.time_of_day_to_sun_elevation(0.0)
	for sample in [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]:
		assert_float(midnight).is_less_equal(BLVillageBase.time_of_day_to_sun_elevation(sample))


func test_night_amount_at_noon_is_approximately_zero() -> void:
	assert_float(BLVillageBase.night_amount(0.5)).is_equal_approx(0.0, 0.001)


func test_night_amount_at_midnight_is_approximately_one() -> void:
	assert_float(BLVillageBase.night_amount(0.0)).is_equal_approx(1.0, 0.001)


func test_sun_elevation_is_symmetric_around_noon() -> void:
	for offset in [0.05, 0.1, 0.2, 0.3, 0.45]:
		var before_noon: float = BLVillageBase.time_of_day_to_sun_elevation(0.5 - offset)
		var after_noon: float = BLVillageBase.time_of_day_to_sun_elevation(0.5 + offset)
		assert_float(before_noon).is_equal_approx(after_noon, 0.0001)


func test_night_amount_is_symmetric_around_noon() -> void:
	for offset in [0.05, 0.1, 0.2, 0.3, 0.45]:
		var before_noon: float = BLVillageBase.night_amount(0.5 - offset)
		var after_noon: float = BLVillageBase.night_amount(0.5 + offset)
		assert_float(before_noon).is_equal_approx(after_noon, 0.0001)
