class_name GoldenVectors
extends RefCounted

static func load_fixture() -> Dictionary:
	var f := FileAccess.open("res://tests/fixtures/golden_vectors.json", FileAccess.READ)
	assert(f != null, "Failed to open golden_vectors.json: error %d" % FileAccess.get_open_error())
	var text := f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(text)
	assert(parsed is Dictionary, "golden_vectors.json did not parse to a Dictionary")
	return parsed
