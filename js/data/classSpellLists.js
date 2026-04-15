// Class Spell Lists - 2024 PHB Rules
// Contains spell lists for each class and subclass

// Bard Spell List (2024)
const BARD_SPELLS = [
    // Cantrips
    "Blade Ward", "Dancing Lights", "Friends", "Light", "Mage Hand", "Message", "Minor Illusion",
    "Prestidigitation", "Thunderclap", "True Strike", "Vicious Mockery",
    // 1st Level
    "Animal Friendship", "Bane", "Charm Person", "Color Spray", "Command", "Comprehend Languages",
    "Cure Wounds", "Detect Magic", "Disguise Self", "Dissonant Whispers", "Faerie Fire",
    "Feather Fall", "Healing Word", "Heroism", "Identify", "Illusory Script", "Longstrider",
    "Silent Image", "Sleep", "Speak with Animals", "Tasha's Hideous Laughter", "Thunderwave",
    // 2nd Level
    "Aid", "Animal Messenger", "Blindness/Deafness", "Calm Emotions", "Cloud of Daggers",
    "Crown of Madness", "Detect Thoughts", "Enhance Ability", "Enthrall", "Heat Metal",
    "Hold Person", "Invisibility", "Knock", "Lesser Restoration", "Locate Animals or Plants",
    "Locate Object", "Magic Mouth", "Mirror Image", "Phantasmal Force", "See Invisibility",
    "Shatter", "Silence", "Suggestion", "Zone of Truth",
    // 3rd Level
    "Bestow Curse", "Clairvoyance", "Dispel Magic", "Fear", "Feign Death", "Glyph of Warding",
    "Hypnotic Pattern", "Leomund's Tiny Hut", "Major Image", "Mass Healing Word", "Nondetection",
    "Plant Growth", "Sending", "Slow", "Speak with Dead", "Speak with Plants", "Stinking Cloud",
    "Tongues",
    // 4th Level
    "Charm Monster", "Compulsion", "Confusion", "Dimension Door", "Freedom of Movement",
    "Greater Invisibility", "Hallucinatory Terrain", "Locate Creature", "Phantasmal Killer",
    "Polymorph",
    // 5th Level
    "Animate Objects", "Awaken", "Dominate Person", "Dream", "Geas", "Greater Restoration",
    "Hold Monster", "Legend Lore", "Mass Cure Wounds", "Mislead", "Modify Memory",
    "Planar Binding", "Raise Dead", "Scrying", "Seeming", "Synaptic Static", "Teleportation Circle",
    // 6th Level
    "Eyebite", "Find the Path", "Guards and Wards", "Heroes' Feast", "Mass Suggestion",
    "Otto's Irresistible Dance", "Programmed Illusion", "True Seeing",
    // 7th Level
    "Dream of the Blue Veil", "Etherealness", "Forcecage", "Mirage Arcane", "Mordenkainen's Magnificent Mansion",
    "Mordenkainen's Sword", "Prismatic Spray", "Project Image", "Regenerate", "Resurrection",
    "Symbol", "Teleport",
    // 8th Level
    "Antipathy/Sympathy", "Dominate Monster", "Feeblemind", "Glibness", "Mind Blank", "Power Word Stun",
    // 9th Level
    "Foresight", "Mass Polymorph", "Power Word Heal", "Power Word Kill", "Prismatic Wall", "True Polymorph"
];

// Cleric Spell List (2024)
const CLERIC_SPELLS = [
    // Cantrips
    "Guidance", "Light", "Mending", "Resistance", "Sacred Flame", "Spare the Dying", 
    "Thaumaturgy", "Toll the Dead", "Word of Radiance",
    // 1st Level
    "Bane", "Bless", "Command", "Create or Destroy Water", "Cure Wounds", "Detect Evil and Good",
    "Detect Magic", "Detect Poison and Disease", "Guiding Bolt", "Healing Word", "Inflict Wounds",
    "Protection from Evil and Good", "Purify Food and Drink", "Sanctuary", "Shield of Faith",
    // 2nd Level
    "Aid", "Augury", "Blindness/Deafness", "Calm Emotions", "Continual Flame", "Enhance Ability",
    "Find Traps", "Gentle Repose", "Hold Person", "Lesser Restoration", "Locate Object",
    "Prayer of Healing", "Protection from Poison", "Silence", "Spiritual Weapon", "Warding Bond",
    "Zone of Truth",
    // 3rd Level
    "Animate Dead", "Beacon of Hope", "Bestow Curse", "Clairvoyance", "Create Food and Water",
    "Daylight", "Dispel Magic", "Feign Death", "Glyph of Warding", "Magic Circle",
    "Mass Healing Word", "Meld into Stone", "Protection from Energy", "Remove Curse", "Revivify",
    "Sending", "Speak with Dead", "Spirit Guardians", "Tongues", "Water Walk",
    // 4th Level
    "Aura of Life", "Aura of Purity", "Banishment", "Control Water", "Death Ward", "Divination",
    "Freedom of Movement", "Guardian of Faith", "Locate Creature", "Stone Shape",
    // 5th Level
    "Commune", "Contagion", "Dispel Evil and Good", "Flame Strike", "Geas", "Greater Restoration",
    "Hallow", "Insect Plague", "Legend Lore", "Mass Cure Wounds", "Planar Binding", "Raise Dead",
    "Scrying", "Summon Celestial",
    // 6th Level
    "Blade Barrier", "Create Undead", "Find the Path", "Forbiddance", "Harm", "Heal",
    "Heroes' Feast", "Planar Ally", "True Seeing", "Word of Recall",
    // 7th Level
    "Conjure Celestial", "Divine Word", "Etherealness", "Fire Storm", "Plane Shift", "Regenerate",
    "Resurrection", "Symbol",
    // 8th Level
    "Antimagic Field", "Control Weather", "Earthquake", "Holy Aura",
    // 9th Level
    "Astral Projection", "Gate", "Mass Heal", "Power Word Heal", "True Resurrection"
];

// Druid Spell List (2024)
const DRUID_SPELLS = [
    // Cantrips
    "Druidcraft", "Guidance", "Mending", "Message", "Poison Spray", "Produce Flame",
    "Resistance", "Shillelagh", "Spare the Dying", "Starry Wisp", "Thorn Whip", "Thunderclap",
    // 1st Level
    "Animal Friendship", "Charm Person", "Create or Destroy Water", "Cure Wounds", "Detect Magic",
    "Detect Poison and Disease", "Entangle", "Faerie Fire", "Fog Cloud", "Goodberry", "Healing Word",
    "Ice Knife", "Jump", "Longstrider", "Purify Food and Drink", "Speak with Animals", "Thunderwave",
    // 2nd Level
    "Animal Messenger", "Augury", "Barkskin", "Beast Sense", "Continual Flame", "Darkvision",
    "Enhance Ability", "Enlarge/Reduce", "Find Traps", "Flame Blade", "Flaming Sphere",
    "Gust of Wind", "Heat Metal", "Hold Person", "Lesser Restoration", "Locate Animals or Plants",
    "Locate Object", "Moonbeam", "Pass without Trace", "Protection from Poison", "Spike Growth",
    // 3rd Level
    "Call Lightning", "Conjure Animals", "Daylight", "Dispel Magic", "Elemental Weapon",
    "Feign Death", "Meld into Stone", "Plant Growth", "Protection from Energy", "Revivify",
    "Sleet Storm", "Speak with Plants", "Summon Fey", "Water Breathing", "Water Walk", "Wind Wall",
    // 4th Level
    "Blight", "Charm Monster", "Confusion", "Conjure Minor Elementals", "Conjure Woodland Beings",
    "Control Water", "Dominate Beast", "Fire Shield", "Freedom of Movement", "Giant Insect",
    "Grasping Vine", "Guardian of Nature", "Hallucinatory Terrain", "Ice Storm", "Locate Creature",
    "Polymorph", "Stone Shape", "Stoneskin", "Summon Elemental", "Wall of Fire",
    // 5th Level
    "Antilife Shell", "Awaken", "Commune with Nature", "Cone of Cold", "Conjure Elemental",
    "Contagion", "Geas", "Greater Restoration", "Insect Plague", "Mass Cure Wounds", "Planar Binding",
    "Reincarnate", "Scrying", "Tree Stride", "Wall of Stone", "Wrath of Nature",
    // 6th Level
    "Conjure Fey", "Find the Path", "Heal", "Heroes' Feast", "Move Earth", "Sunbeam",
    "Transport via Plants", "Wall of Thorns", "Wind Walk",
    // 7th Level
    "Fire Storm", "Mirage Arcane", "Plane Shift", "Regenerate", "Reverse Gravity", "Symbol",
    // 8th Level
    "Animal Shapes", "Antipathy/Sympathy", "Control Weather", "Earthquake", "Feeblemind",
    "Incendiary Cloud", "Sunburst", "Tsunami",
    // 9th Level
    "Foresight", "Shapechange", "Storm of Vengeance", "True Resurrection"
];

// Paladin Spell List (2024)
const PALADIN_SPELLS = [
    // 1st Level
    "Bless", "Command", "Compelled Duel", "Cure Wounds", "Detect Evil and Good", "Detect Magic",
    "Detect Poison and Disease", "Divine Favor", "Divine Smite", "Heroism", "Protection from Evil and Good",
    "Purify Food and Drink", "Searing Smite", "Shield of Faith", "Thunderous Smite", "Wrathful Smite",
    // 2nd Level
    "Aid", "Find Steed", "Gentle Repose", "Lesser Restoration", "Locate Object", "Magic Weapon",
    "Prayer of Healing", "Protection from Poison", "Shining Smite", "Warding Bond", "Zone of Truth",
    // 3rd Level
    "Aura of Vitality", "Blinding Smite", "Create Food and Water", "Crusader's Mantle", "Daylight",
    "Dispel Magic", "Elemental Weapon", "Magic Circle", "Remove Curse", "Revivify",
    // 4th Level
    "Aura of Life", "Aura of Purity", "Banishment", "Death Ward", "Locate Creature", "Staggering Smite",
    // 5th Level
    "Banishing Smite", "Circle of Power", "Destructive Wave", "Dispel Evil and Good", "Geas",
    "Greater Restoration", "Holy Weapon", "Raise Dead", "Summon Celestial"
];

// Ranger Spell List (2024)
const RANGER_SPELLS = [
    // Cantrips (Rangers get cantrips in 2024)
    "Druidcraft", "Guidance", "Mending", "Message", "Produce Flame", "Resistance",
    "Shillelagh", "Spare the Dying", "Thorn Whip", "Thunderclap",
    // 1st Level
    "Alarm", "Animal Friendship", "Cure Wounds", "Detect Magic", "Detect Poison and Disease",
    "Ensnaring Strike", "Entangle", "Fog Cloud", "Goodberry", "Hail of Thorns", "Hunter's Mark",
    "Jump", "Longstrider", "Speak with Animals",
    // 2nd Level
    "Aid", "Animal Messenger", "Barkskin", "Beast Sense", "Cordon of Arrows", "Darkvision",
    "Enhance Ability", "Find Traps", "Gust of Wind", "Lesser Restoration", "Locate Animals or Plants",
    "Locate Object", "Magic Weapon", "Pass without Trace", "Protection from Poison", "Silence",
    "Spike Growth", "Summon Beast",
    // 3rd Level
    "Conjure Animals", "Conjure Barrage", "Daylight", "Dispel Magic", "Elemental Weapon",
    "Lightning Arrow", "Meld into Stone", "Nondetection", "Plant Growth", "Protection from Energy",
    "Revivify", "Speak with Plants", "Summon Fey", "Water Breathing", "Water Walk", "Wind Wall",
    // 4th Level
    "Conjure Woodland Beings", "Dominate Beast", "Freedom of Movement", "Grasping Vine",
    "Guardian of Nature", "Locate Creature", "Stoneskin", "Summon Elemental",
    // 5th Level
    "Commune with Nature", "Conjure Volley", "Greater Restoration", "Steel Wind Strike",
    "Swift Quiver", "Tree Stride", "Wrath of Nature"
];

// Sorcerer Spell List (2024)
const SORCERER_SPELLS = [
    // Cantrips
    "Acid Splash", "Blade Ward", "Chill Touch", "Dancing Lights", "Elementalism", "Fire Bolt",
    "Friends", "Light", "Mage Hand", "Message", "Mind Sliver", "Minor Illusion", "Poison Spray",
    "Prestidigitation", "Ray of Frost", "Shocking Grasp", "Sorcerous Burst", "Thunderclap", "True Strike",
    // 1st Level
    "Burning Hands", "Charm Person", "Chromatic Orb", "Color Spray", "Comprehend Languages",
    "Detect Magic", "Disguise Self", "Expeditious Retreat", "False Life", "Feather Fall",
    "Fog Cloud", "Grease", "Ice Knife", "Jump", "Mage Armor", "Magic Missile", "Ray of Sickness",
    "Shield", "Silent Image", "Sleep", "Thunderwave",
    // 2nd Level
    "Alter Self", "Arcane Vigor", "Blindness/Deafness", "Blur", "Cloud of Daggers", "Crown of Madness",
    "Darkness", "Darkvision", "Detect Thoughts", "Dragon's Breath", "Enhance Ability",
    "Enlarge/Reduce", "Gust of Wind", "Hold Person", "Invisibility", "Knock", "Levitate",
    "Mirror Image", "Misty Step", "Phantasmal Force", "Scorching Ray", "See Invisibility",
    "Shatter", "Spider Climb", "Suggestion", "Web",
    // 3rd Level
    "Blink", "Clairvoyance", "Counterspell", "Daylight", "Dispel Magic", "Fear", "Fireball",
    "Fly", "Gaseous Form", "Haste", "Hypnotic Pattern", "Lightning Bolt", "Major Image",
    "Protection from Energy", "Sleet Storm", "Slow", "Stinking Cloud", "Tongues", "Vampiric Touch",
    "Water Breathing", "Water Walk",
    // 4th Level
    "Banishment", "Blight", "Charm Monster", "Confusion", "Dimension Door", "Dominate Beast",
    "Greater Invisibility", "Ice Storm", "Polymorph", "Stoneskin", "Vitriolic Sphere",
    "Wall of Fire",
    // 5th Level
    "Animate Objects", "Cloudkill", "Cone of Cold", "Creation", "Dominate Person", "Hold Monster",
    "Insect Plague", "Seeming", "Synaptic Static", "Telekinesis", "Teleportation Circle",
    "Wall of Stone",
    // 6th Level
    "Arcane Gate", "Chain Lightning", "Circle of Death", "Disintegrate", "Eyebite", "Globe of Invulnerability",
    "Mass Suggestion", "Move Earth", "Scatter", "Sunbeam", "True Seeing",
    // 7th Level
    "Delayed Blast Fireball", "Etherealness", "Finger of Death", "Fire Storm", "Plane Shift",
    "Prismatic Spray", "Reverse Gravity", "Teleport",
    // 8th Level
    "Dominate Monster", "Earthquake", "Incendiary Cloud", "Power Word Stun", "Sunburst",
    // 9th Level
    "Gate", "Meteor Swarm", "Power Word Kill", "Time Stop", "Wish"
];

// Warlock Spell List (2024)
const WARLOCK_SPELLS = [
    // Cantrips
    "Blade Ward", "Chill Touch", "Eldritch Blast", "Friends", "Mage Hand", "Mind Sliver",
    "Minor Illusion", "Poison Spray", "Prestidigitation", "Thunderclap", "Toll the Dead", "True Strike",
    // 1st Level
    "Armor of Agathys", "Arms of Hadar", "Bane", "Charm Person", "Comprehend Languages",
    "Expeditious Retreat", "Hellish Rebuke", "Hex", "Illusory Script", "Protection from Evil and Good",
    "Speak with Animals", "Tasha's Hideous Laughter", "Unseen Servant", "Witch Bolt",
    // 2nd Level
    "Cloud of Daggers", "Crown of Madness", "Darkness", "Enthrall", "Hold Person", "Invisibility",
    "Mind Spike", "Mirror Image", "Misty Step", "Ray of Enfeeblement", "Shatter",
    "Spider Climb", "Suggestion",
    // 3rd Level
    "Counterspell", "Dispel Magic", "Fear", "Fly", "Gaseous Form", "Hunger of Hadar",
    "Hypnotic Pattern", "Magic Circle", "Major Image", "Remove Curse", "Summon Fey",
    "Summon Lesser Demons", "Summon Undead", "Tongues", "Vampiric Touch",
    // 4th Level
    "Banishment", "Blight", "Charm Monster", "Dimension Door", "Hallucinatory Terrain",
    "Shadow of Moil", "Sickening Radiance", "Summon Aberration", "Summon Greater Demon",
    // 5th Level
    "Contact Other Plane", "Danse Macabre", "Dream", "Enervation", "Far Step", "Hold Monster",
    "Infernal Calling", "Mislead", "Negative Energy Flood", "Planar Binding", "Scrying",
    "Synaptic Static", "Teleportation Circle", "Wall of Light",
    // 6th Level
    "Arcane Gate", "Circle of Death", "Conjure Fey", "Create Undead", "Eyebite",
    "Flesh to Stone", "Investiture of Flame", "Investiture of Ice", "Investiture of Stone",
    "Investiture of Wind", "Mass Suggestion", "Mental Prison", "Scatter", "Soul Cage", "True Seeing",
    // 7th Level
    "Crown of Stars", "Etherealness", "Finger of Death", "Forcecage", "Plane Shift", "Power Word Pain",
    // 8th Level
    "Demiplane", "Dominate Monster", "Feeblemind", "Glibness", "Maddening Darkness", "Power Word Stun",
    // 9th Level
    "Astral Projection", "Blade of Disaster", "Foresight", "Gate", "Imprisonment",
    "Power Word Kill", "Psychic Scream", "True Polymorph"
];

// Wizard Spell List (2024)
const WIZARD_SPELLS = [
    // Cantrips
    "Acid Splash", "Blade Ward", "Chill Touch", "Dancing Lights", "Elementalism", "Fire Bolt",
    "Friends", "Light", "Mage Hand", "Message", "Mind Sliver", "Minor Illusion", "Poison Spray",
    "Prestidigitation", "Ray of Frost", "Shocking Grasp", "Thunderclap", "Toll the Dead", "True Strike",
    // 1st Level
    "Alarm", "Burning Hands", "Charm Person", "Chromatic Orb", "Color Spray", "Comprehend Languages",
    "Detect Magic", "Disguise Self", "Expeditious Retreat", "False Life", "Feather Fall",
    "Find Familiar", "Fog Cloud", "Grease", "Ice Knife", "Identify", "Illusory Script", "Jump",
    "Longstrider", "Mage Armor", "Magic Missile", "Protection from Evil and Good", "Ray of Sickness",
    "Shield", "Silent Image", "Sleep", "Tasha's Hideous Laughter", "Tenser's Floating Disk",
    "Thunderwave", "Unseen Servant", "Witch Bolt",
    // 2nd Level
    "Alter Self", "Arcane Lock", "Arcane Vigor", "Augury", "Blindness/Deafness", "Blur",
    "Cloud of Daggers", "Continual Flame", "Crown of Madness", "Darkness", "Darkvision",
    "Detect Thoughts", "Dragon's Breath", "Enlarge/Reduce", "Flaming Sphere", "Gentle Repose",
    "Gust of Wind", "Hold Person", "Invisibility", "Knock", "Levitate", "Locate Object",
    "Magic Mouth", "Magic Weapon", "Melf's Acid Arrow", "Mind Spike", "Mirror Image", "Misty Step",
    "Nystul's Magic Aura", "Phantasmal Force", "Ray of Enfeeblement", "Rope Trick", "Scorching Ray",
    "See Invisibility", "Shatter", "Spider Climb", "Suggestion", "Web",
    // 3rd Level
    "Animate Dead", "Bestow Curse", "Blink", "Clairvoyance", "Counterspell", "Dispel Magic",
    "Fear", "Feign Death", "Fireball", "Fly", "Gaseous Form", "Glyph of Warding", "Haste",
    "Hypnotic Pattern", "Leomund's Tiny Hut", "Lightning Bolt", "Magic Circle", "Major Image",
    "Nondetection", "Phantom Steed", "Protection from Energy", "Remove Curse", "Sending",
    "Sleet Storm", "Slow", "Stinking Cloud", "Summon Fey", "Summon Lesser Demons",
    "Summon Shadowspawn", "Summon Undead", "Tiny Servant", "Tongues", "Vampiric Touch", "Water Breathing",
    // 4th Level
    "Arcane Eye", "Banishment", "Blight", "Charm Monster", "Confusion", "Conjure Minor Elementals",
    "Control Water", "Dimension Door", "Divination", "Evard's Black Tentacles", "Fabricate",
    "Fire Shield", "Greater Invisibility", "Hallucinatory Terrain", "Ice Storm", "Leomund's Secret Chest",
    "Locate Creature", "Mordenkainen's Faithful Hound", "Mordenkainen's Private Sanctum",
    "Otiluke's Resilient Sphere", "Phantasmal Killer", "Polymorph", "Stone Shape", "Stoneskin",
    "Summon Aberration", "Summon Construct", "Summon Elemental", "Summon Greater Demon",
    "Vitriolic Sphere", "Wall of Fire",
    // 5th Level
    "Animate Objects", "Bigby's Hand", "Cloudkill", "Cone of Cold", "Conjure Elemental",
    "Contact Other Plane", "Creation", "Danse Macabre", "Dawn", "Dominate Person", "Dream",
    "Enervation", "Far Step", "Geas", "Hold Monster", "Infernal Calling", "Legend Lore",
    "Mislead", "Modify Memory", "Negative Energy Flood", "Passwall", "Planar Binding",
    "Rary's Telepathic Bond", "Scrying", "Seeming", "Steel Wind Strike", "Summon Draconic Spirit",
    "Synaptic Static", "Telekinesis", "Teleportation Circle", "Wall of Force", "Wall of Light",
    "Wall of Stone",
    // 6th Level
    "Arcane Gate", "Chain Lightning", "Circle of Death", "Contingency", "Create Homunculus",
    "Create Undead", "Disintegrate", "Drawmij's Instant Summons", "Eyebite", "Flesh to Stone",
    "Globe of Invulnerability", "Guards and Wards", "Investiture of Flame", "Investiture of Ice",
    "Investiture of Stone", "Investiture of Wind", "Magic Jar", "Mass Suggestion", "Mental Prison",
    "Move Earth", "Otiluke's Freezing Sphere", "Otto's Irresistible Dance", "Programmed Illusion",
    "Scatter", "Soul Cage", "Sunbeam", "Tasha's Otherworldly Guise", "Tenser's Transformation",
    "True Seeing", "Wall of Ice",
    // 7th Level
    "Crown of Stars", "Delayed Blast Fireball", "Etherealness", "Finger of Death", "Forcecage",
    "Mirage Arcane", "Mordenkainen's Magnificent Mansion", "Mordenkainen's Sword", "Plane Shift",
    "Power Word Pain", "Prismatic Spray", "Project Image", "Reverse Gravity", "Sequester",
    "Simulacrum", "Symbol", "Teleport",
    // 8th Level
    "Antimagic Field", "Antipathy/Sympathy", "Clone", "Control Weather", "Demiplane",
    "Dominate Monster", "Feeblemind", "Illusory Dragon", "Incendiary Cloud", "Maddening Darkness",
    "Maze", "Mighty Fortress", "Mind Blank", "Power Word Stun", "Sunburst", "Telepathy",
    // 9th Level
    "Astral Projection", "Blade of Disaster", "Foresight", "Gate", "Imprisonment", "Meteor Swarm",
    "Power Word Kill", "Prismatic Wall", "Psychic Scream", "Shapechange", "Time Stop",
    "True Polymorph", "Weird", "Wish"
];

// Subclass Spell Lists (2024)
// These spells are added to the class spell list when the subclass is selected

const SUBCLASS_SPELLS = {
    // Barbarian Subclasses (non-spellcasting)
    "Path of the Berserker": [],
    "Path of the Wild Heart": [],
    "Path of the World Tree": [],
    "Path of the Zealot": [],
    
    // Bard Subclasses
    "College of Lore": [],  // No additional spells, gets Magical Secrets earlier
    "College of Valor": [],  // No additional spells
    "College of Glamour": ["Command", "Mirror Image", "Charm Monster", "Compulsion", "Dominate Person"],
    "College of Dance": ["Mirror Image", "Aid", "Haste", "Freedom of Movement", "Greater Restoration"],
    
    // Cleric Subclasses (Domain Spells - always prepared)
    "Life Domain": ["Bless", "Cure Wounds", "Lesser Restoration", "Spiritual Weapon", "Beacon of Hope", "Revivify", "Death Ward", "Guardian of Faith", "Greater Restoration", "Mass Cure Wounds"],
    "Light Domain": ["Burning Hands", "Faerie Fire", "Flaming Sphere", "Scorching Ray", "Daylight", "Fireball", "Guardian of Faith", "Wall of Fire", "Flame Strike", "Scrying"],
    "Trickery Domain": ["Charm Person", "Disguise Self", "Mirror Image", "Pass without Trace", "Blink", "Dispel Magic", "Dimension Door", "Polymorph", "Dominate Person", "Modify Memory"],
    "War Domain": ["Divine Favor", "Shield of Faith", "Magic Weapon", "Spiritual Weapon", "Crusader's Mantle", "Spirit Guardians", "Freedom of Movement", "Stoneskin", "Flame Strike", "Hold Monster"],
    
    // Druid Subclasses (Circle Spells)
    "Circle of the Land (Arctic)": ["Hold Person", "Spike Growth", "Sleet Storm", "Slow", "Cone of Cold", "Freedom of Movement", "Commune with Nature", "Cone of Cold"],
    "Circle of the Land (Coast)": ["Mirror Image", "Misty Step", "Water Breathing", "Water Walk", "Control Water", "Freedom of Movement", "Conjure Elemental", "Scrying"],
    "Circle of the Land (Desert)": ["Blur", "Silence", "Create Food and Water", "Protection from Energy", "Blight", "Hallucinatory Terrain", "Insect Plague", "Wall of Stone"],
    "Circle of the Land (Forest)": ["Barkskin", "Spider Climb", "Call Lightning", "Plant Growth", "Divination", "Freedom of Movement", "Commune with Nature", "Tree Stride"],
    "Circle of the Land (Grassland)": ["Invisibility", "Pass without Trace", "Daylight", "Haste", "Divination", "Freedom of Movement", "Dream", "Insect Plague"],
    "Circle of the Land (Mountain)": ["Spider Climb", "Spike Growth", "Lightning Bolt", "Meld into Stone", "Stone Shape", "Stoneskin", "Passwall", "Wall of Stone"],
    "Circle of the Land (Swamp)": ["Darkness", "Melf's Acid Arrow", "Water Walk", "Stinking Cloud", "Freedom of Movement", "Locate Creature", "Insect Plague", "Scrying"],
    "Circle of the Land (Underdark)": ["Spider Climb", "Web", "Gaseous Form", "Stinking Cloud", "Greater Invisibility", "Stone Shape", "Cloudkill", "Insect Plague"],
    "Circle of the Moon": [],  // Combat Wild Shape, no extra spells
    "Circle of the Sea": ["Fog Cloud", "Gust of Wind", "Shatter", "Thunderwave", "Lightning Bolt", "Water Breathing", "Control Water", "Ice Storm", "Cone of Cold", "Conjure Elemental"],
    "Circle of Stars": ["Guiding Bolt", "Faerie Fire", "Augury", "Moonbeam", "Hypnotic Pattern", "Call Lightning", "Divination", "Guardian of Faith", "Contact Other Plane", "Scrying"],

    // Fighter Subclasses
    "Champion": [],  // No spellcasting
    "Battle Master": [],  // No spellcasting
    "Eldritch Knight": "WIZARD_ABJURATION_EVOCATION",  // Special: uses Wizard spells (Abjuration/Evocation focus)
    
    // Monk Subclasses
    "Warrior of the Open Hand": [],
    "Warrior of Shadow": [],
    "Warrior of the Elements": [],
    
    // Paladin Subclasses (Oath Spells)
    "Oath of Devotion": ["Protection from Evil and Good", "Sanctuary", "Lesser Restoration", "Zone of Truth", "Beacon of Hope", "Dispel Magic", "Freedom of Movement", "Guardian of Faith", "Commune", "Flame Strike"],
    "Oath of the Ancients": ["Ensnaring Strike", "Speak with Animals", "Moonbeam", "Misty Step", "Plant Growth", "Protection from Energy", "Ice Storm", "Stoneskin", "Commune with Nature", "Tree Stride"],
    "Oath of Vengeance": ["Bane", "Hunter's Mark", "Hold Person", "Misty Step", "Haste", "Protection from Energy", "Banishment", "Dimension Door", "Hold Monster", "Scrying"],
    "Oath of Glory": ["Guiding Bolt", "Heroism", "Enhance Ability", "Magic Weapon", "Haste", "Protection from Energy", "Compulsion", "Freedom of Movement", "Commune", "Flame Strike"],
    
    // Ranger Subclasses
    "Hunter": [],  // No additional spells
    "Beast Master": [],  // No additional spells
    "Gloom Stalker": ["Disguise Self", "Rope Trick", "Fear", "Greater Invisibility", "Seeming"],
    "Fey Wanderer": ["Charm Person", "Misty Step", "Dispel Magic", "Dimension Door", "Mislead"],
    
    // Sorcerer Subclasses
    "Draconic Bloodline": [],  // Gets elemental affinity, not spells
    "Wild Magic": [],  // Wild Magic Surge, not spells
    "Aberrant Mind": ["Arms of Hadar", "Dissonant Whispers", "Calm Emotions", "Detect Thoughts", "Hunger of Hadar", "Sending", "Evard's Black Tentacles", "Summon Aberration", "Rary's Telepathic Bond", "Telekinesis"],
    "Clockwork Soul": ["Alarm", "Protection from Evil and Good", "Aid", "Lesser Restoration", "Dispel Magic", "Protection from Energy", "Freedom of Movement", "Summon Construct", "Greater Restoration", "Wall of Force"],
    "Divine Soul": ["Cure Wounds", "Guiding Bolt", "Lesser Restoration", "Spiritual Weapon", "Revivify", "Spirit Guardians", "Death Ward", "Guardian of Faith", "Greater Restoration", "Flame Strike"],
    
    // Warlock Subclasses (Expanded Spell List)
    "The Archfey": ["Faerie Fire", "Sleep", "Calm Emotions", "Phantasmal Force", "Blink", "Plant Growth", "Dominate Beast", "Greater Invisibility", "Dominate Person", "Seeming"],
    "The Fiend": ["Burning Hands", "Command", "Blindness/Deafness", "Scorching Ray", "Fireball", "Stinking Cloud", "Fire Shield", "Wall of Fire", "Flame Strike", "Hallow"],
    "The Great Old One": ["Dissonant Whispers", "Tasha's Hideous Laughter", "Detect Thoughts", "Phantasmal Force", "Clairvoyance", "Sending", "Dominate Beast", "Evard's Black Tentacles", "Dominate Person", "Telekinesis"],
    "The Celestial": ["Cure Wounds", "Guiding Bolt", "Flaming Sphere", "Lesser Restoration", "Daylight", "Revivify", "Guardian of Faith", "Wall of Fire", "Flame Strike", "Greater Restoration"],
    "The Hexblade": ["Shield", "Wrathful Smite", "Blur", "Branding Smite", "Blink", "Elemental Weapon", "Phantasmal Killer", "Staggering Smite", "Banishing Smite", "Cone of Cold"],
    
    // Rogue Subclasses
    "Thief": [],  // No spellcasting
    "Assassin": [],  // No spellcasting
    "Arcane Trickster": "WIZARD_ENCHANTMENT_ILLUSION",  // Special: uses Wizard spells (Enchantment/Illusion focus)
    "Soulknife": [],  // Psionic, not spellcasting
    
    // Wizard Subclasses (School specializations - no extra spells, but school benefits)
    "School of Abjuration": [],
    "School of Conjuration": [],
    "School of Divination": [],
    "School of Enchantment": [],
    "School of Evocation": [],
    "School of Illusion": [],
    "School of Necromancy": [],
    "School of Transmutation": [],
    "Bladesinging": [],
    "War Magic": []
};

// Map of class names to their spell lists
const CLASS_SPELL_LISTS = {
    "Bard": BARD_SPELLS,
    "Cleric": CLERIC_SPELLS,
    "Druid": DRUID_SPELLS,
    "Paladin": PALADIN_SPELLS,
    "Ranger": RANGER_SPELLS,
    "Sorcerer": SORCERER_SPELLS,
    "Warlock": WARLOCK_SPELLS,
    "Wizard": WIZARD_SPELLS
};

// List of all spellcasting classes
const SPELLCASTING_CLASSES = ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];

/**
 * Get the list of spells available to a class
 * @param {string} className - The class name (e.g., "Wizard")
 * @returns {string[]} Array of spell names
 */
export function getClassSpells(className) {
    // Normalize class name (handle case variations)
    const normalizedClass = SPELLCASTING_CLASSES.find(
        c => c.toLowerCase() === className?.toLowerCase()
    );
    return CLASS_SPELL_LISTS[normalizedClass] || [];
}

/**
 * Get the list of spells granted by a subclass
 * @param {string} subclassName - The subclass name (e.g., "Life Domain")
 * @returns {string[]} Array of spell names (empty for special markers like "WIZARD_ABJURATION_EVOCATION")
 */
export function getSubclassSpells(subclassName) {
    if (!subclassName) return [];
    
    // Try exact match first
    let spells = SUBCLASS_SPELLS[subclassName];
    
    // If not found, try case-insensitive match
    if (spells === undefined) {
        const normalizedName = subclassName.toLowerCase();
        for (const [key, value] of Object.entries(SUBCLASS_SPELLS)) {
            if (key.toLowerCase() === normalizedName) {
                spells = value;
                break;
            }
        }
    }
    
    // If spells is a string (special marker), return empty array
    // The special markers are handled in getAvailableSpells
    if (typeof spells === 'string') {
        return [];
    }
    
    return spells || [];
}

/**
 * Get all spells available to a character based on class and subclass
 * @param {string} className - The class name
 * @param {string} subclassName - The subclass name (optional)
 * @returns {string[]} Array of spell names (deduplicated)
 */
export function getAvailableSpells(className, subclassName) {
    const classSpells = getClassSpells(className);
    const subclassSpells = getSubclassSpells(subclassName);
    
    // Check if subclass has a special marker for spellcasting
    let specialSubclassSpells = [];
    if (subclassName) {
        // Find the special marker
        let marker = SUBCLASS_SPELLS[subclassName];
        if (marker === undefined) {
            // Try case-insensitive match
            const normalizedName = subclassName.toLowerCase();
            for (const [key, value] of Object.entries(SUBCLASS_SPELLS)) {
                if (key.toLowerCase() === normalizedName) {
                    marker = value;
                    break;
                }
            }
        }
        
        // Handle special markers
        if (typeof marker === 'string') {
            if (marker === 'WIZARD_ABJURATION_EVOCATION') {
                // Eldritch Knight: Wizard spells, focused on Abjuration and Evocation
                // They can learn any Wizard spell, but we'll return the full list
                specialSubclassSpells = getClassSpells('Wizard');
            } else if (marker === 'WIZARD_ENCHANTMENT_ILLUSION') {
                // Arcane Trickster: Wizard spells, focused on Enchantment and Illusion
                // They can learn any Wizard spell, but we'll return the full list
                specialSubclassSpells = getClassSpells('Wizard');
            }
        }
    }
    
    // Combine and deduplicate
    const allSpells = new Set([...classSpells, ...subclassSpells, ...specialSubclassSpells]);
    return Array.from(allSpells);
}

/**
 * Check if a spell is available to a class
 * @param {string} spellName - The spell name
 * @param {string} className - The class name
 * @param {string} subclassName - The subclass name (optional)
 * @returns {boolean}
 */
export function isSpellAvailable(spellName, className, subclassName) {
    const availableSpells = getAvailableSpells(className, subclassName);
    return availableSpells.some(s => s.toLowerCase() === spellName.toLowerCase());
}

/**
 * Check if a class is a spellcasting class
 * @param {string} className - The class name
 * @returns {boolean}
 */
export function isSpellcastingClass(className) {
    return SPELLCASTING_CLASSES.some(c => c.toLowerCase() === className?.toLowerCase());
}

// Subclasses that grant spellcasting to non-spellcasting classes
const SPELLCASTING_SUBCLASSES = {
    "Eldritch Knight": "WIZARD_ABJURATION_EVOCATION",
    "Arcane Trickster": "WIZARD_ENCHANTMENT_ILLUSION"
};

/**
 * Check if a subclass grants spellcasting (for non-spellcasting base classes)
 * @param {string} subclassName - The subclass name
 * @returns {boolean}
 */
export function isSpellcastingSubclass(subclassName) {
    if (!subclassName) return false;
    
    // Try exact match
    if (SPELLCASTING_SUBCLASSES[subclassName]) return true;
    
    // Try case-insensitive match
    const normalizedName = subclassName.toLowerCase();
    return Object.keys(SPELLCASTING_SUBCLASSES).some(
        key => key.toLowerCase() === normalizedName
    );
}

// All D&D 5e classes (2024)
const ALL_CLASSES = [
    "Barbarian", "Bard", "Cleric", "Druid", "Fighter", 
    "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"
];

/**
 * Get all available classes
 * @returns {string[]} Array of class names
 */
export function getAllClasses() {
    return [...ALL_CLASSES];
}

/**
 * Get all available subclasses for a class
 * @param {string} className - The class name
 * @returns {string[]} Array of subclass names
 */
export function getSubclassesForClass(className) {
    const subclasses = {
        "Barbarian": ["Path of the Berserker", "Path of the Wild Heart", "Path of the World Tree", "Path of the Zealot"],
        "Bard": ["College of Lore", "College of Valor", "College of Glamour", "College of Dance"],
        "Cleric": ["Life Domain", "Light Domain", "Trickery Domain", "War Domain"],
        "Druid": ["Circle of the Land (Arctic)", "Circle of the Land (Coast)", "Circle of the Land (Desert)", 
                  "Circle of the Land (Forest)", "Circle of the Land (Grassland)", "Circle of the Land (Mountain)",
                  "Circle of the Land (Swamp)", "Circle of the Land (Underdark)", "Circle of the Moon",
                  "Circle of the Sea", "Circle of Stars"],
        "Fighter": ["Champion", "Battle Master", "Eldritch Knight"],
        "Monk": ["Warrior of the Open Hand", "Warrior of Shadow", "Warrior of the Elements"],
        "Paladin": ["Oath of Devotion", "Oath of the Ancients", "Oath of Vengeance", "Oath of Glory"],
        "Ranger": ["Hunter", "Beast Master", "Gloom Stalker", "Fey Wanderer"],
        "Rogue": ["Thief", "Assassin", "Arcane Trickster", "Soulknife"],
        "Sorcerer": ["Draconic Bloodline", "Wild Magic", "Aberrant Mind", "Clockwork Soul", "Divine Soul"],
        "Warlock": ["The Archfey", "The Fiend", "The Great Old One", "The Celestial", "The Hexblade"],
        "Wizard": ["School of Abjuration", "School of Conjuration", "School of Divination", 
                   "School of Enchantment", "School of Evocation", "School of Illusion",
                   "School of Necromancy", "School of Transmutation", "Bladesinging", "War Magic"]
    };
    
    // Try to find the class (case-insensitive)
    const normalizedClass = ALL_CLASSES.find(
        c => c.toLowerCase() === className?.toLowerCase()
    );
    
    return subclasses[normalizedClass] || [];
}

export { SPELLCASTING_CLASSES, ALL_CLASSES };
