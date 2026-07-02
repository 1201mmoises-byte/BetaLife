extends Node

## BetaLife's FIRST autoload (registered as `Roster` in project.godot's
## [autoload] section — see village-base-3d-scene-design spec's Amendment 5).
## In-memory-only hero storage that lets Dev-Panel-generated heroes carry
## over into the village scene. No persistence/SQLite yet — the roster
## resets on restart; `godot-sqlite`-backed persistence remains future work.
##
## Deliberately dumb: this autoload holds an Array of hero Dictionaries (the
## canonical record shape produced by BLHeroFactory.generate(), see
## scripts/engine/hero_factory.gd) and nothing else. No engine/generation
## logic lives here — that's BLHeroFactory's job. This keeps Roster reusable
## by any future consumer (village_sim.gd's Phase 4 tick, UI panels) without
## coupling them to generation internals.

signal hero_added(hero: Dictionary)

var _heroes: Array[Dictionary] = []


## Appends `hero` (expected to be a BLHeroFactory.generate()-shaped record,
## but this autoload doesn't validate the shape — that's the caller's job)
## and emits hero_added so listeners (e.g. village_base.gd) can react.
func add_hero(hero: Dictionary) -> void:
	_heroes.append(hero)
	hero_added.emit(hero)


## Returns the live roster. Callers that need to mutate independently of the
## roster's own array should duplicate it first.
func get_heroes() -> Array[Dictionary]:
	return _heroes


## True if a hero with this `id` is already in the roster. Lets callers
## (e.g. the Dev Panel's save button) keep ids unique without this autoload
## enforcing anything itself — still dumb storage, this is just a lookup.
func has_hero(id: String) -> bool:
	for hero in _heroes:
		if String(hero.get("id", "")) == id:
			return true
	return false


## Empties the roster without emitting any signal (no hero_removed signal
## exists yet — nothing currently needs one).
func clear() -> void:
	_heroes.clear()
