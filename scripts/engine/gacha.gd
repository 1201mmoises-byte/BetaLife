class_name BLGacha
extends RefCounted

## Ports src/engine/gacha.ts (weighted star-rating rolls for Hero summoning).

# Base weights at difficulty 1 (the easiest world, where penalty = 0, so
# these ARE the visible probabilities). Anchored by design:
#   5* = 1%  (ceiling -- extremely rare even at the easiest difficulty)
#   3* = 10% (the "normal rare")
# 1*/2*/4* fill the rest with a clean monotonic descent.
const BASE_WEIGHTS: Dictionary = {
	1: 0.60,
	2: 0.25,
	3: 0.10,
	4: 0.04,
	5: 0.01,
}

# How hard difficulty crushes the high tiers. Higher = steeper collapse.
# Calibrated so that at difficulty 999 / floor 0, P(5*) ~= 1e-7 (~0.00001%).
const PENALTY_STRENGTH: float = 3.0

const DIFFICULTY_MIN: int = 1
const DIFFICULTY_MAX: int = 1000

# Floor bonus (roster-wide meta progression). Every 10 floors completed
# SUBTRACTS penalty (and can push 5* above base, up to a ceiling). The bonus
# accrues from the deepest floor the roster has reached, and improves ALL
# future summons. The bonus per step SCALES with difficulty (each floor is
# worth more in brutal worlds -- the crucible rewards climbing):
#   difficulty 1,    floor 90  -> 25% 5* (ceiling)
#   difficulty 1000, floor 100 -> 1%  5* (base, finally recovered)
const M_CAP: float = 1.25                 # exponent giving ~25% 5* -- absolute ceiling
const FLOORS_PER_STEP: int = 10           # every 10 floors = one bonus step
const FLOORS_TO_CAP_EASY: int = 90        # easy world reaches the ceiling at floor 90
const FLOORS_TO_CANCEL_MAX: int = 100     # hardest world cancels its penalty at floor 100

const PER_STEP_EASY: float = M_CAP / (float(FLOORS_TO_CAP_EASY) / float(FLOORS_PER_STEP))
const PER_STEP_HARD: float = PENALTY_STRENGTH / (float(FLOORS_TO_CANCEL_MAX) / float(FLOORS_PER_STEP))

const STAR_TIERS: Array[int] = [1, 2, 3, 4, 5]

## Difficulty is the root property of a seed/world (1-1000, hidden from
## player). Rolled independently -- each world has its own inherent crucible.
static func roll_difficulty(seeder: BLSeeder) -> int:
	return seeder.branch("difficulty").next_int(DIFFICULTY_MIN, DIFFICULTY_MAX)

static func _clamp01(x: float) -> float:
	if x < 0.0:
		return 0.0
	if x > 1.0:
		return 1.0
	return x

# Net per-tier exponent `m`: floorBonus - difficultyPenalty, clamped to M_CAP.
#   m < 0 -> high tiers suppressed (hard world, few floors climbed)
#   m = 0 -> base distribution (60/25/10/4/1)
#   m > 0 -> high tiers boosted above base, up to the 25% 5* ceiling
# At floor 0 this reduces to the original difficulty-only model.
static func _compute_exponent(difficulty: int, roster_floor: int) -> float:
	var norm: float = _clamp01(float(difficulty - DIFFICULTY_MIN) / float(DIFFICULTY_MAX - DIFFICULTY_MIN))
	var difficulty_penalty: float = PENALTY_STRENGTH * norm

	var per_step: float = PER_STEP_EASY + (PER_STEP_HARD - PER_STEP_EASY) * norm
	var steps: int = int(floor(float(max(0, roster_floor)) / float(FLOORS_PER_STEP)))
	var floor_bonus: float = per_step * steps

	return min(M_CAP, floor_bonus - difficulty_penalty)

## Per-tier probability distribution for a given difficulty and global roster
## progress. Higher tiers decay with difficulty and recover (then exceed
## base, capped at 25% 5*) as the roster climbs. `roster_floor` defaults to 0.
static func star_probabilities(difficulty: int, roster_floor: int = 0) -> Dictionary:
	var m: float = _compute_exponent(difficulty, roster_floor)

	var weights: Dictionary = {}
	var total: float = 0.0
	for s in STAR_TIERS:
		var w: float = float(BASE_WEIGHTS[s]) * exp(m * float(s - 1))
		weights[s] = w
		total += w

	var probs: Dictionary = {}
	for s in STAR_TIERS:
		probs[s] = weights[s] / total
	return probs

## Rolls a star rating conditioned on difficulty and global roster progress.
## `roster_floor` is the deepest floor any character has completed at summon time.
static func roll_stars(seeder: BLSeeder, difficulty: int, roster_floor: int = 0) -> int:
	var probs: Dictionary = star_probabilities(difficulty, roster_floor)
	var roll: float = seeder.branch("stars").next_float()

	var cumulative: float = 0.0
	for s in STAR_TIERS:
		cumulative += probs[s]
		if roll < cumulative:
			return s
	return 1 # floating-point safety net
