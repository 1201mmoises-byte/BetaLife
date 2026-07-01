extends GdUnitTestSuite

# Mirrors the coherence checks in BetaLife's scripts/testEngine.ts (lines ~61-107),
# scoped to the modules ported in Milestone 1: seeder, axes, archetypes, stamps,
# nameGenerator. Full NPC-level coherence (which also touches npcGenerator/town/
# world) is re-verified in the Milestone 2 plan once those are ported.

const SAMPLE_SIZE: int = 500

func test_determinism_same_seed_same_output() -> void:
	for trial in 5:
		var seed: String = "determinism-check:%d" % trial
		var axes_a: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var axes_b: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		assert_dict(axes_a).is_equal(axes_b)

		var name_a: String = BLNameGenerator.generate_name(BLSeeder.new(seed), "hispano", axes_a)
		var name_b: String = BLNameGenerator.generate_name(BLSeeder.new(seed), "hispano", axes_b)
		assert_str(name_a).is_equal(name_b)

func test_birth_stamp_seals_archetype_primary_axis() -> void:
	# Every NPC whose archetype declares a primaryAxis must have its birth
	# stamp on exactly that axis (stamp <-> origin coherence).
	for i in SAMPLE_SIZE:
		var seed: String = "coherence:%d" % i
		var arch: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(BLSeeder.new(seed))
		if arch.primary_axis == "":
			continue
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed), arch)
		var stamp: BLStamps.Stamp = BLStamps.seal_birth_stamp(axes, arch, 0)
		assert_str(stamp.axis_key).is_equal(arch.primary_axis)

func test_emergent_trait_correlates_with_archetype() -> void:
	# Each named archetype should make its matching emergent trait fire for
	# the large majority of rolls (not 100% - the other AND-conditions vary).
	var expected_trait_for_archetype: Dictionary = {
		"honor": "honor",
		"imprudente": "imprudencia extrema",
		"calido": "nobleza",
		"rencoroso": "rencor",
	}
	var hits: Dictionary = {}
	var totals: Dictionary = {}
	for id in expected_trait_for_archetype.keys():
		hits[id] = 0
		totals[id] = 0

	for i in SAMPLE_SIZE:
		var seed: String = "coherence:%d" % i
		var arch: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(BLSeeder.new(seed))
		if not expected_trait_for_archetype.has(arch.id):
			continue
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed), arch)
		totals[arch.id] += 1
		var traits: Array[String] = BLAxes.read_emergent_traits(axes)
		if traits.has(expected_trait_for_archetype[arch.id]):
			hits[arch.id] += 1

	for id in expected_trait_for_archetype.keys():
		if totals[id] == 0:
			continue
		var rate: float = float(hits[id]) / float(totals[id])
		assert_float(rate).is_greater(0.7) # generous floor; TS run typically shows 80-95%+

func test_name_uniqueness_across_many_seeds() -> void:
	var names: Dictionary = {}
	var collisions: int = 0
	for i in SAMPLE_SIZE:
		var seed: String = "distrib-test:%d" % i
		var axes: Dictionary = BLAxes.generate_axes(BLSeeder.new(seed))
		var culture: String = BLNameGenerator.generate_culture(BLSeeder.new(seed))
		var name: String = BLNameGenerator.generate_name(BLSeeder.new(seed), culture, axes)
		if names.has(name):
			collisions += 1
		names[name] = true
	assert_int(collisions).is_equal(0)
