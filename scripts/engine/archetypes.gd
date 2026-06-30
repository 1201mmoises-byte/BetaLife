class_name BLArchetypes
extends RefCounted

## Ports src/engine/archetypes.ts.

class OriginArchetype:
	extends RefCounted
	var id: String
	var weight: float
	var signature: Dictionary # String -> Array[float] of length 2: [min, max]
	var primary_axis: String  # "" means "no primary axis" (TS: undefined)
	var fragments: Array[String]

	func _init(p_id: String, p_weight: float, p_signature: Dictionary, p_primary_axis: String, p_fragments: Array[String]) -> void:
		id = p_id
		weight = p_weight
		signature = p_signature
		primary_axis = p_primary_axis
		fragments = p_fragments

static func get_archetypes() -> Array[OriginArchetype]:
	return [
		OriginArchetype.new(
			"honor", 1.0,
			{
				"integrity": [0.72, 0.93],
				"loyalty": [0.72, 0.95],
				"altruism": [0.62, 0.88],
			},
			"integrity",
			[
				"Creció en una familia que ponía el honor por encima de la supervivencia.",
				"Aprendió desde joven que romper una promesa era peor que morir.",
				"Su linaje cargó vergüenzas ajenas durante generaciones; juró no añadir más.",
			],
		),
		OriginArchetype.new(
			"imprudente", 1.0,
			{
				"caution": [0.05, 0.28],
				"discipline": [0.05, 0.33],
				"passivity": [0.05, 0.35],
			},
			"caution",
			[
				"Nunca terminó nada que empezó, pero eso nunca le frenó de intentarlo.",
				"Fue expulsado de tres gremios por insubordinación, y está orgulloso de ello.",
				"Sus cicatrices cuentan historias que su memoria ya no puede.",
			],
		),
		OriginArchetype.new(
			"calido", 1.0,
			{
				"warmth": [0.76, 0.96],
				"altruism": [0.66, 0.90],
				"sociability": [0.55, 0.90],
			},
			"warmth",
			[
				"Recogió a mendigos en invierno cuando nadie más lo hacía.",
				"Su puerta nunca estuvo cerrada para los que llegaban con hambre.",
				"Perdió su fortuna ayudando a extraños; nunca lo lamentó del todo.",
			],
		),
		OriginArchetype.new(
			"rencoroso", 1.0,
			{
				"trust": [0.05, 0.24],
				"forgiveness": [0.05, 0.29],
				"warmth": [0.10, 0.45],
			},
			"trust",
			[
				"Alguien a quien amaba lo traicionó. No olvidó. No perdonó.",
				"Aprendió que la confianza es un lujo que los ingenuos pagan caro.",
				"Guarda cada deuda como monedas en un bolso que nunca vacía.",
			],
		),
		OriginArchetype.new(
			"erudito", 1.0,
			{
				"curiosity": [0.76, 0.97],
				"discipline": [0.62, 0.90],
				"caution": [0.55, 0.85],
			},
			"curiosity",
			[
				"Llenó cuadernos enteros antes de cumplir doce años.",
				"Viajó a lugares donde el mapa terminaba solo para ver qué había más allá.",
				"Su maestro dijo que sabía demasiado para su propio bien. Tenía razón.",
			],
		),
		OriginArchetype.new(
			"difuso", 1.5,
			{},
			"",
			[
				"Su pasado es difuso, como arena que el viento remodela continuamente.",
				"No habla de dónde vino. Nadie ha insistido lo suficiente.",
				"Llegó al pueblo sin más pertenencias que lo puesto y una historia a medias.",
			],
		),
	]

static func pick_archetype(seeder: BLSeeder) -> OriginArchetype:
	var a_seeder: BLSeeder = seeder.branch("archetype")
	var archetypes: Array[OriginArchetype] = get_archetypes()
	var total: float = 0.0
	for a in archetypes:
		total += a.weight
	var roll: float = a_seeder.next_float(0.0, total)
	for a in archetypes:
		roll -= a.weight
		if roll < 0.0:
			return a
	return archetypes[archetypes.size() - 1]
