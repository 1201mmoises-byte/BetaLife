class_name BLNameGenerator
extends RefCounted

## Ports src/engine/nameGenerator.ts.

const CULTURES: Array[String] = ["hispano", "nordico", "celta", "eslavo", "greco", "africano", "asiatico"]

const PHONEMES: Dictionary = {
	"hispano": {
		"pre": ["Al", "El", "Ca", "Mar", "Ra", "Sol", "Ven", "Bel", "Dar", "Gal", "Cor", "Ser", "Tan", "Lun", "Vel", "Bra", "Cas", "Fer", "Nor", "Sal", "Tor", "Mer"],
		"root": ["an", "or", "en", "al", "ir", "os", "ar", "ur", "es", "iel", "ael", "and", "eri", "ond", "ial", "uel", "anz", "erm", "ost", "ind", "alv", "ern"],
		"mid": ["a", "e", "i", "o", "ri", "li", "na", "se", "ta", "va", "ra", "le", "mi", "no", "da", "ne", "lo", "sa", "te", "vi", "ro", "ca"],
		"suf": ["o", "a", "io", "ia", "on", "an", "in", "el", "ez", "ar", "os", "eo", "un", "il", "az", "or", "ano", "ina", "eno", "ius", "alo", "eria"],
	},
	"nordico": {
		"pre": ["Bjor", "Thor", "Sig", "Ulf", "Heid", "Gur", "Rag", "Var", "Frey", "Arn", "Eir", "Hak", "Sten", "Grim", "Hald", "Sval", "Orm", "Tyr", "Skar", "Volk", "Gunn", "Rurik"],
		"root": ["nar", "vik", "ald", "ulf", "mund", "gar", "helm", "bor", "den", "fen", "rik", "stein", "grim", "vald", "skog", "thal", "norn", "gisl", "rond", "hild", "svein", "falk"],
		"mid": ["a", "e", "i", "o", "u", "da", "ne", "la", "ri", "va", "sa", "to", "ke", "no", "ga", "me", "lo", "se", "ta", "vi", "do", "ru"],
		"suf": ["son", "ir", "en", "ar", "ur", "ik", "on", "r", "n", "a", "dr", "ulf", "ald", "mir", "gar", "vid", "rok", "nir", "helm", "stad", "und", "borg"],
	},
	"celta": {
		"pre": ["Bran", "Cai", "Der", "Fio", "Gor", "Mor", "Nua", "Rhi", "Tal", "Eil", "Aed", "Bre", "Cael", "Dun", "Ferg", "Gwyn", "Lugh", "Niamh", "Oran", "Sael", "Teag", "Caw"],
		"root": ["agh", "wyn", "eth", "ael", "dhu", "ran", "ban", "hir", "enn", "mor", "lyr", "wen", "tach", "gwel", "nith", "arod", "beth", "cael", "duin", "fael", "goch", "lain"],
		"mid": ["a", "e", "i", "y", "o", "ai", "we", "ru", "na", "li", "dy", "ce", "ma", "ne", "lo", "ri", "sa", "te", "vi", "do", "el", "in"],
		"suf": ["an", "yn", "on", "wen", "ith", "och", "ach", "ael", "in", "ion", "wyn", "dd", "ek", "rys", "agh", "ven", "lyn", "mor", "gan", "ed", "ys", "aith"],
	},
	"eslavo": {
		"pre": ["Dra", "Mir", "Bog", "Vla", "Svet", "Kaz", "Rad", "Zla", "Yar", "Gor", "Bor", "Lud", "Sta", "Tom", "Ves", "Woj", "Zor", "Bran", "Dmi", "Ksen", "Mst", "Rus"],
		"root": ["imir", "odar", "oslav", "adin", "enka", "idar", "omir", "ivan", "usha", "olan", "eslav", "omil", "aros", "imko", "enko", "oryn", "astan", "evod", "islav", "omash", "uril", "azek"],
		"mid": ["a", "e", "i", "o", "u", "ya", "ne", "ri", "lo", "va", "sa", "do", "ze", "na", "mi", "to", "le", "ro", "se", "vi", "da", "ko"],
		"suf": ["ov", "ev", "a", "in", "ko", "mir", "ski", "ych", "nov", "uk", "enko", "slav", "omir", "ek", "ina", "oslav", "ich", "an", "ar", "el", "osh", "yna"],
	},
	"greco": {
		"pre": ["Alex", "Kali", "The", "Dem", "Nik", "Pho", "Kyr", "Ath", "Eos", "Kro", "Lys", "Mel", "Orph", "Pan", "Sel", "Tha", "Xen", "Zeph", "Arist", "Diog", "Hera", "Leon"],
		"root": ["andr", "istr", "oph", "eter", "akis", "ipos", "enos", "aros", "iran", "okas", "andro", "ekle", "imen", "ophan", "ister", "agor", "edon", "ophil", "arch", "eides", "olaos", "ythen"],
		"mid": ["a", "e", "i", "o", "io", "ia", "es", "os", "an", "el", "on", "er", "al", "is", "or", "en", "ar", "ne", "ro", "ti", "le", "me"],
		"suf": ["os", "is", "as", "on", "ia", "e", "us", "ios", "eos", "anes", "ides", "andros", "ikos", "enes", "ator", "okles", "iton", "aios", "eus", "oros", "ipos", "ymos"],
	},
	"africano": {
		"pre": ["Ama", "Kwa", "Zub", "Osi", "Lek", "Tau", "Aya", "Ngo", "Eba", "Ima", "Bara", "Chid", "Dala", "Femi", "Jabu", "Kofi", "Mosi", "Nuru", "Obi", "Sade", "Thabo", "Zola"],
		"root": ["inde", "ara", "ube", "ole", "abo", "ema", "uru", "ike", "enu", "olo", "andi", "eshe", "iola", "unde", "abeo", "imba", "okon", "esha", "ulum", "anke", "ireh", "oseh"],
		"mid": ["a", "e", "i", "o", "u", "na", "we", "lo", "mi", "ba", "ya", "se", "ko", "ru", "da", "le", "ni", "to", "sa", "wo", "ma", "zu"],
		"suf": ["we", "a", "i", "u", "e", "yo", "ba", "ko", "si", "tu", "la", "na", "di", "mba", "nde", "ola", "esi", "ayo", "umi", "eke", "oro", "isha"],
	},
	"asiatico": {
		"pre": ["Ren", "Yuki", "Hiro", "Min", "Tao", "Xia", "Jun", "Hana", "Ryu", "Mei", "Kai", "Lin", "Nao", "Qing", "Sora", "Wei", "Yi", "Zhen", "Akio", "Daiki", "Feng", "Haru"],
		"root": ["saki", "zen", "taro", "fang", "nori", "yama", "haru", "kaze", "moto", "shiro", "jian", "kawa", "long", "mura", "sora", "tian", "waka", "xing", "yoshi", "zhao", "hoshi", "inu"],
		"mid": ["a", "e", "i", "o", "u", "no", "ka", "mi", "ra", "shi", "ko", "na", "to", "ya", "ki", "ru", "sa", "chi", "ma", "wa", "zu", "ne"],
		"suf": ["ko", "ka", "ki", "ro", "to", "na", "mi", "shi", "ra", "yu", "ji", "sho", "taro", "hito", "ren", "sei", "long", "feng", "lan", "wei", "ying", "hua"],
	},
}

static func _phonetic_hardness(axes: Dictionary) -> float:
	return (1.0 - float(axes["passivity"])) * 0.5 + (1.0 - float(axes["warmth"])) * 0.5

# Ports hardenName()'s three regex passes exactly:
#   1. /v/gi -> 'k'
#   2. /l([aeiou])/gi -> 'r$1'
#   3. /[aeiou]{2}/gi -> first char of the match (non-overlapping scan)
static func _harden_name(name: String, hardness: float) -> String:
	if hardness < 0.55:
		return name
	var result: String = name

	var re_v := RegEx.new()
	re_v.compile("[vV]")
	result = re_v.sub(result, "k", true)

	var re_l := RegEx.new()
	re_l.compile("[lL]([aeiouAEIOU])")
	result = re_l.sub(result, "r$1", true)

	var re_vv := RegEx.new()
	re_vv.compile("([aeiouAEIOU])[aeiouAEIOU]")
	result = re_vv.sub(result, "$1", true)

	return result

static func generate_culture(seeder: BLSeeder) -> String:
	return String(seeder.branch("culture").next_choice(CULTURES))

static func _unique_count(arr: Array) -> int:
	var seen: Dictionary = {}
	for v in arr:
		seen[v] = true
	return seen.size()

static func name_namespace_size() -> int:
	var total: int = 0
	for culture in CULTURES:
		var pool: Dictionary = PHONEMES[culture]
		total += _unique_count(pool["pre"]) * _unique_count(pool["root"]) * _unique_count(pool["mid"]) * _unique_count(pool["suf"])
	return total

static func generate_name(seeder: BLSeeder, culture: String, axes: Dictionary) -> String:
	var ns: BLSeeder = seeder.branch("name")
	var pool: Dictionary = PHONEMES[culture]
	var pre: String = String(ns.next_choice(pool["pre"]))
	var root: String = String(ns.next_choice(pool["root"]))
	var mid: String = String(ns.next_choice(pool["mid"]))
	var suf: String = String(ns.next_choice(pool["suf"]))

	var raw: String = pre + root + mid + suf
	var name: String = raw.substr(0, 1).to_upper() + raw.substr(1).to_lower()
	return _harden_name(name, _phonetic_hardness(axes))
