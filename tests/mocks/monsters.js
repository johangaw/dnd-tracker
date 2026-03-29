// Mock monster data for tests
// Simplified versions of 5e.tools monster format

export const mockMonsters = {
  goblin: {
    name: "Goblin",
    source: "MM",
    size: ["S"],
    type: "humanoid",
    alignment: ["N", "E"],
    ac: [{ ac: 15, from: ["leather armor", "shield"] }],
    hp: { average: 7, formula: "2d6" },
    speed: { walk: 30 },
    str: 8,
    dex: 14,
    con: 10,
    int: 10,
    wis: 8,
    cha: 8,
    skill: { stealth: "+6" },
    senses: ["darkvision 60 ft."],
    passive: 9,
    languages: ["Common", "Goblin"],
    cr: "1/4",
    action: [
      {
        name: "Scimitar",
        entries: ["{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) slashing damage."]
      }
    ]
  },
  
  orc: {
    name: "Orc",
    source: "MM",
    size: ["M"],
    type: "humanoid",
    alignment: ["C", "E"],
    ac: [{ ac: 13, from: ["hide armor"] }],
    hp: { average: 15, formula: "2d8 + 6" },
    speed: { walk: 30 },
    str: 16,
    dex: 12,
    con: 16,
    int: 7,
    wis: 11,
    cha: 10,
    skill: { intimidation: "+2" },
    senses: ["darkvision 60 ft."],
    passive: 10,
    languages: ["Common", "Orc"],
    cr: "1/2",
    trait: [
      {
        name: "Aggressive",
        entries: ["As a bonus action, the orc can move up to its speed toward a hostile creature that it can see."]
      }
    ],
    action: [
      {
        name: "Greataxe",
        entries: ["{@atk mw} {@hit 5} to hit, reach 5 ft., one target. {@h}9 ({@damage 1d12 + 3}) slashing damage."]
      }
    ]
  },
  
  dragon: {
    name: "Young Red Dragon",
    source: "MM",
    size: ["L"],
    type: "dragon",
    alignment: ["C", "E"],
    ac: [{ ac: 18, from: ["natural armor"] }],
    hp: { average: 178, formula: "17d10 + 85" },
    speed: { walk: 40, climb: 40, fly: 80 },
    str: 23,
    dex: 10,
    con: 21,
    int: 14,
    wis: 11,
    cha: 19,
    save: { dex: "+4", con: "+9", wis: "+4", cha: "+8" },
    skill: { perception: "+8", stealth: "+4" },
    immune: ["fire"],
    senses: ["blindsight 30 ft.", "darkvision 120 ft."],
    passive: 18,
    languages: ["Common", "Draconic"],
    cr: "10",
    trait: [],
    action: [
      {
        name: "Multiattack",
        entries: ["The dragon makes three attacks: one with its bite and two with its claws."]
      },
      {
        name: "Fire Breath {@recharge 5}",
        entries: ["The dragon exhales fire in a 30-foot cone. Each creature in that area must make a {@dc 17} Dexterity saving throw, taking 56 ({@damage 16d6}) fire damage on a failed save, or half as much damage on a successful one."]
      }
    ]
  },
  
  skeleton: {
    name: "Skeleton",
    source: "MM",
    size: ["M"],
    type: "undead",
    alignment: ["L", "E"],
    ac: [{ ac: 13, from: ["armor scraps"] }],
    hp: { average: 13, formula: "2d8 + 4" },
    speed: { walk: 30 },
    str: 10,
    dex: 14,
    con: 15,
    int: 6,
    wis: 8,
    cha: 5,
    vulnerable: ["bludgeoning"],
    immune: ["poison"],
    conditionImmune: ["exhaustion", "poisoned"],
    senses: ["darkvision 60 ft."],
    passive: 9,
    languages: ["understands all languages it knew in life but can't speak"],
    cr: "1/4",
    action: [
      {
        name: "Shortsword",
        entries: ["{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) piercing damage."]
      },
      {
        name: "Shortbow",
        entries: ["{@atk rw} {@hit 4} to hit, range 80/320 ft., one target. {@h}5 ({@damage 1d6 + 2}) piercing damage."]
      }
    ]
  }
}

// Index format matching data/bestiary/index.json
export const mockIndex = {
  "MM": "bestiary-mm.json"
}

// Bestiary file format matching data/bestiary/bestiary-mm.json
export const mockBestiary = {
  monster: Object.values(mockMonsters)
}

// Helper to get a monster by name (case-insensitive)
export function getMockMonster(name) {
  const key = Object.keys(mockMonsters).find(
    k => mockMonsters[k].name.toLowerCase() === name.toLowerCase()
  )
  return key ? mockMonsters[key] : null
}

// Helper to search monsters by name
export function searchMockMonsters(query) {
  const lowerQuery = query.toLowerCase()
  return Object.values(mockMonsters).filter(
    m => m.name.toLowerCase().includes(lowerQuery)
  )
}
