extends GdUnitTestSuite

func test_smoke() -> void:
	assert_that(1 + 1).is_equal(2)
