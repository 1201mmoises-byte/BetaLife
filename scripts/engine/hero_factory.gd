class_name BLHeroFactory
extends RefCounted

## Shared hero-generation pipeline, extracted from scripts/dev/dev_panel.gd's
## original inline generation code (Phase 2C, see the village-base-3d-scene-
## design spec's Amendment 5 "Roster autoload"). Wires the already-ported
## engine modules end-to-end:
##   seed string -> BLSeeder -> pick_archetype -> generate_axes ->
##   read_emergent_traits -> generate_culture/generate_name ->
##   roll_difficulty/roll_stars -> fragment choice -> role derivation
## Pure and static: the same seed string always produces an identical record
## (see tests/engine/test_hero_factory.gd). Both scripts/dev/dev_panel.gd and
## scripts/village/village_base.gd call generate() so there is exactly one
## generation path.
##
## Every field on `seeder` here that isn't a direct branch() call is a
## *branch* of the root seeder — BLSeeder.branch() derives a brand-new
## independent seeder from `_seed_string + ":" + suffix` rather than
## consuming the root seeder's own PRNG state, so the order these branch()
## calls happen in below does not affect one another's outputs. That's what
## lets role derivation (added this phase, via seeder.branch("role")) slot in
## without perturbing any of the pre-existing fields' values for a given seed
## string (see test_generate_matches_hand_inlined_original_pipeline).

## Role taxonomy, in canonical order. The 4 roles the previz's `ROLE_VIS`
## covered (warrior/mage/rogue/archer) — this project has 6 origin archetypes
## (see BLArchetypes), so role is a many-to-4 deterministic mapping, not a
## 1:1 relabeling of archetype id.
const ROLES: Array[String] = ["warrior", "mage", "rogue", "archer"]

## Visual palette per role: skin/armor/leg/accent colors + headgear kind,
## mirroring the previz's ROLE_VIS. Lives here (not on hero_figure.gd) so the
## role taxonomy and its palette have one source of truth that both the
## factory (which assigns role) and the view layer (which paints it) share;
## hero_figure.gd just reads BLHeroFactory.ROLE_VIS[hero.role].
const ROLE_VIS: Dictionary = {
	"warrior": {
		"skin": Color(0.85, 0.68, 0.55),
		"armor": Color(0.55, 0.10, 0.10),
		"legs": Color(0.30, 0.28, 0.26),
		"accent": Color(0.75, 0.65, 0.20),
		"headgear": "helmet",
	},
	"mage": {
		"skin": Color(0.85, 0.68, 0.55),
		"armor": Color(0.20, 0.25, 0.65),
		"legs": Color(0.15, 0.15, 0.30),
		"accent": Color(0.55, 0.35, 0.85),
		"headgear": "hood",
	},
	"rogue": {
		"skin": Color(0.80, 0.62, 0.48),
		"armor": Color(0.12, 0.35, 0.18),
		"legs": Color(0.10, 0.10, 0.12),
		"accent": Color(0.30, 0.55, 0.30),
		"headgear": "hood",
	},
	"archer": {
		"skin": Color(0.85, 0.68, 0.55),
		"armor": Color(0.35, 0.45, 0.15),
		"legs": Color(0.25, 0.30, 0.15),
		"accent": Color(0.75, 0.55, 0.20),
		"headgear": "cap",
	},
}

## Per-archetype role weights (design judgment call, documented here rather
## than left implicit): each of the 6 origin archetypes leans toward the
## role(s) its signature axes evoke, but never excludes any role outright
## (every weight is > 0) so a given archetype can still roll any role, just
## with different odds:
##   honor      (integrity/loyalty/altruism)     -> warrior-leaning (disciplined, front-line)
##   imprudente (low caution/discipline)         -> rogue-leaning (reckless, unpredictable)
##   calido     (warmth/altruism/sociability)     -> mage-leaning (support/caretaker caster)
##   rencoroso  (low trust/forgiveness)           -> rogue-leaning (calculating, holds grudges)
##   erudito    (curiosity/discipline/caution)    -> mage-leaning (scholarly caster)
##   difuso     (no signature)                    -> uniform across all 4 roles
const ARCHETYPE_ROLE_WEIGHTS: Dictionary = {
	"honor": {"warrior": 3.0, "mage": 1.0, "rogue": 1.0, "archer": 2.0},
	"imprudente": {"warrior": 2.5, "mage": 0.5, "rogue": 3.0, "archer": 1.5},
	"calido": {"warrior": 1.0, "mage": 2.5, "rogue": 1.0, "archer": 1.5},
	"rencoroso": {"warrior": 1.5, "mage": 1.0, "rogue": 3.0, "archer": 1.0},
	"erudito": {"warrior": 0.5, "mage": 3.0, "rogue": 1.0, "archer": 1.5},
	"difuso": {"warrior": 1.0, "mage": 1.0, "rogue": 1.0, "archer": 1.0},
}


## Generates one canonical hero record Dictionary for `seed_str`. `id` and
## `seed` are both set to `seed_str` verbatim: the record shape has separate
## fields per the roster contract (scripts/global/roster.gd), but a hero's
## seed string is already expected to be unique per generation (dev panel
## mixes in Time.get_ticks_usec() + a counter; the village's self-seed uses
## explicit "village-seed-N" strings) so reusing it as `id` avoids inventing
## a second, redundant unique-id scheme.
static func generate(seed_str: String) -> Dictionary:
	var seeder: BLSeeder = BLSeeder.new(seed_str)

	var archetype: BLArchetypes.OriginArchetype = BLArchetypes.pick_archetype(seeder)
	var axes: Dictionary = BLAxes.generate_axes(seeder, archetype)
	var traits: Array[String] = BLAxes.read_emergent_traits(axes)
	var culture: String = BLNameGenerator.generate_culture(seeder)
	var hero_name: String = BLNameGenerator.generate_name(seeder, culture, axes)
	var difficulty: int = BLGacha.roll_difficulty(seeder)
	var stars: int = BLGacha.roll_stars(seeder, difficulty)
	var fragment: String = String(seeder.branch("fragment").next_choice(archetype.fragments))
	var role: String = _pick_role(seeder, archetype.id)

	return {
		"id": seed_str,
		"seed": seed_str,
		"name": hero_name,
		"culture": culture,
		"archetype_id": archetype.id,
		"stars": stars,
		"difficulty": difficulty,
		"axes": axes,
		"traits": traits,
		"fragment": fragment,
		"role": role,
	}


## Weighted role pick, seeded from `seeder.branch("role")` (independent of
## every other branch above — see the file header note on why call order
## doesn't matter) using the archetype's weight table. Mirrors
## BLArchetypes.pick_archetype's own "roll a running total, subtract weights"
## pattern.
static func _pick_role(seeder: BLSeeder, archetype_id: String) -> String:
	var role_seeder: BLSeeder = seeder.branch("role")
	var weights: Dictionary = ARCHETYPE_ROLE_WEIGHTS.get(archetype_id, ARCHETYPE_ROLE_WEIGHTS["difuso"])

	var total: float = 0.0
	for role in ROLES:
		total += float(weights.get(role, 1.0))

	var roll: float = role_seeder.next_float(0.0, total)
	for role in ROLES:
		roll -= float(weights.get(role, 1.0))
		if roll < 0.0:
			return role
	return ROLES[ROLES.size() - 1]
