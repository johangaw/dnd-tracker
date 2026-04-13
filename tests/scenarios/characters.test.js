// Tests for Character Sheet feature
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initApp, click, tick, exists, getText } from '../helpers.js'
import * as Characters from '../../js/services/characters.js'

describe('Characters Service', () => {
    beforeEach(async () => {
        await initApp()
    })

    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    describe('CRUD operations', () => {
        it('creates and retrieves a character', () => {
            const character = Characters.createEmptyCharacter()
            character.name = 'Test Hero'
            character.class = 'Fighter'
            character.level = 5
            
            Characters.saveCharacter(character)
            
            const retrieved = Characters.getCharacter(character.id)
            expect(retrieved).toBeDefined()
            expect(retrieved.name).toBe('Test Hero')
            expect(retrieved.class).toBe('Fighter')
            expect(retrieved.level).toBe(5)
        })

        it('updates an existing character', () => {
            const character = Characters.createEmptyCharacter()
            character.name = 'Test Hero'
            Characters.saveCharacter(character)
            
            character.name = 'Updated Hero'
            character.level = 10
            Characters.saveCharacter(character)
            
            const retrieved = Characters.getCharacter(character.id)
            expect(retrieved.name).toBe('Updated Hero')
            expect(retrieved.level).toBe(10)
        })

        it('deletes a character', () => {
            const character = Characters.createEmptyCharacter()
            character.name = 'Delete Me'
            Characters.saveCharacter(character)
            
            Characters.deleteCharacter(character.id)
            
            const retrieved = Characters.getCharacter(character.id)
            expect(retrieved).toBeUndefined()
        })

        it('gets all characters', () => {
            const char1 = Characters.createEmptyCharacter()
            char1.name = 'Hero 1'
            Characters.saveCharacter(char1)
            
            const char2 = Characters.createEmptyCharacter()
            char2.name = 'Hero 2'
            Characters.saveCharacter(char2)
            
            const all = Characters.getCharacters()
            expect(all.length).toBe(2)
        })

        it('searches characters by name', () => {
            const char1 = Characters.createEmptyCharacter()
            char1.name = 'Gandalf the Grey'
            char1.class = 'Wizard'
            char1.species = 'Maiar'
            Characters.saveCharacter(char1)
            
            const char2 = Characters.createEmptyCharacter()
            char2.name = 'Aragorn'
            char2.class = 'Ranger'
            char2.species = 'Human'
            Characters.saveCharacter(char2)
            
            const results = Characters.searchCharacters('gandalf')
            expect(results.length).toBe(1)
            expect(results[0].name).toBe('Gandalf the Grey')
        })

        it('searches characters by class', () => {
            const char1 = Characters.createEmptyCharacter()
            char1.name = 'Gandalf'
            char1.class = 'Wizard'
            char1.species = 'Maiar'
            Characters.saveCharacter(char1)
            
            const char2 = Characters.createEmptyCharacter()
            char2.name = 'Aragorn'
            char2.class = 'Ranger'
            char2.species = 'Human'
            Characters.saveCharacter(char2)
            
            const results = Characters.searchCharacters('wizard')
            expect(results.length).toBe(1)
            expect(results[0].name).toBe('Gandalf')
        })
    })

    describe('Ability calculations', () => {
        it('calculates ability modifier correctly', () => {
            expect(Characters.getAbilityModifier(10)).toBe(0)
            expect(Characters.getAbilityModifier(8)).toBe(-1)
            expect(Characters.getAbilityModifier(12)).toBe(1)
            expect(Characters.getAbilityModifier(15)).toBe(2)
            expect(Characters.getAbilityModifier(20)).toBe(5)
            expect(Characters.getAbilityModifier(1)).toBe(-5)
            expect(Characters.getAbilityModifier(30)).toBe(10)
        })

        it('formats modifier with sign', () => {
            expect(Characters.formatModifier(0)).toBe('+0')
            expect(Characters.formatModifier(3)).toBe('+3')
            expect(Characters.formatModifier(-2)).toBe('-2')
        })

        it('calculates proficiency bonus based on level', () => {
            expect(Characters.getProficiencyBonus(1)).toBe(2)
            expect(Characters.getProficiencyBonus(4)).toBe(2)
            expect(Characters.getProficiencyBonus(5)).toBe(3)
            expect(Characters.getProficiencyBonus(8)).toBe(3)
            expect(Characters.getProficiencyBonus(9)).toBe(4)
            expect(Characters.getProficiencyBonus(13)).toBe(5)
            expect(Characters.getProficiencyBonus(17)).toBe(6)
            expect(Characters.getProficiencyBonus(20)).toBe(6)
        })

        it('calculates skill modifier without proficiency', () => {
            const character = Characters.createEmptyCharacter()
            character.abilities.dex = 14 // +2 modifier
            
            const mod = Characters.getSkillModifier(character, 'acrobatics')
            expect(mod).toBe(2)
        })

        it('calculates skill modifier with proficiency', () => {
            const character = Characters.createEmptyCharacter()
            character.level = 1
            character.abilities.dex = 14 // +2 modifier
            character.skillProficiencies = { acrobatics: true }
            
            // +2 DEX + 2 prof = +4
            const mod = Characters.getSkillModifier(character, 'acrobatics')
            expect(mod).toBe(4)
        })

        it('calculates skill modifier with expertise', () => {
            const character = Characters.createEmptyCharacter()
            character.level = 1
            character.abilities.dex = 14 // +2 modifier
            character.skillProficiencies = { acrobatics: true }
            character.skillExpertise = { acrobatics: true }
            
            // +2 DEX + 4 expertise (2x prof) = +6
            const mod = Characters.getSkillModifier(character, 'acrobatics')
            expect(mod).toBe(6)
        })

        it('calculates saving throw modifier without proficiency', () => {
            const character = Characters.createEmptyCharacter()
            character.abilities.str = 16 // +3 modifier
            
            const mod = Characters.getSavingThrowModifier(character, 'str')
            expect(mod).toBe(3)
        })

        it('calculates saving throw modifier with proficiency', () => {
            const character = Characters.createEmptyCharacter()
            character.level = 5
            character.abilities.str = 16 // +3 modifier
            character.saveProficiencies = { str: true }
            
            // +3 STR + 3 prof = +6
            const mod = Characters.getSavingThrowModifier(character, 'str')
            expect(mod).toBe(6)
        })

        it('calculates passive perception', () => {
            const character = Characters.createEmptyCharacter()
            character.abilities.wis = 14 // +2 modifier
            character.skillProficiencies = { perception: true }
            character.level = 1
            
            // 10 + 2 WIS + 2 prof = 14
            const passive = Characters.getPassivePerception(character)
            expect(passive).toBe(14)
        })

        it('calculates initiative modifier', () => {
            const character = Characters.createEmptyCharacter()
            character.abilities.dex = 16 // +3 modifier
            
            const init = Characters.getInitiativeModifier(character)
            expect(init).toBe(3)
        })
    })

    describe('Character duplication', () => {
        it('duplicates a character with new ID and name', () => {
            const original = Characters.createEmptyCharacter()
            original.name = 'Original Hero'
            original.class = 'Paladin'
            original.level = 7
            
            const copy = Characters.duplicateCharacter(original)
            
            expect(copy.id).not.toBe(original.id)
            expect(copy.name).toBe('Original Hero (Copy)')
            expect(copy.class).toBe('Paladin')
            expect(copy.level).toBe(7)
        })
    })

    describe('Import/Export', () => {
        it('exports character to JSON', () => {
            const character = Characters.createEmptyCharacter()
            character.name = 'Export Test'
            character.class = 'Rogue'
            
            const json = Characters.exportCharacterToJSON(character)
            const parsed = JSON.parse(json)
            
            expect(parsed.name).toBe('Export Test')
            expect(parsed.class).toBe('Rogue')
            expect(parsed.id).toBeUndefined()
        })

        it('imports character from JSON', () => {
            const json = JSON.stringify({
                name: 'Imported Hero',
                class: 'Bard',
                level: 3
            })
            
            const character = Characters.importCharacterFromJSON(json)
            
            expect(character.name).toBe('Imported Hero')
            expect(character.class).toBe('Bard')
            expect(character.level).toBe(3)
            expect(character.id).toBeDefined()
        })

        it('throws error when importing JSON without name', () => {
            const json = JSON.stringify({ class: 'Fighter' })
            
            expect(() => Characters.importCharacterFromJSON(json))
                .toThrow('Character must have a name')
        })
    })

    describe('Empty character creation', () => {
        it('creates character with default values', () => {
            const character = Characters.createEmptyCharacter()
            
            expect(character.id).toBeDefined()
            expect(character.name).toBe('')
            expect(character.level).toBe(1)
            expect(character.abilities.str).toBe(10)
            expect(character.abilities.dex).toBe(10)
            expect(character.abilities.con).toBe(10)
            expect(character.abilities.int).toBe(10)
            expect(character.abilities.wis).toBe(10)
            expect(character.abilities.cha).toBe(10)
            expect(character.armorClass).toBe(10)
            expect(character.speed).toBe(30)
        })
    })
})

describe('Character List Component', () => {
    beforeEach(async () => {
        await initApp()
    })

    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    it('shows empty state when no characters', async () => {
        // Navigate to characters view
        await click('#menu-btn')
        await tick()
        await click('#menu-characters')
        await tick()
        
        expect(exists('#characters-view.active')).toBe(true)
        const content = getText('#characters-list')
        expect(content).toContain('No Characters')
    })

    it('shows character cards when characters exist', async () => {
        // Create a character first
        const character = Characters.createEmptyCharacter()
        character.name = 'Test Wizard'
        character.class = 'Wizard'
        character.level = 5
        character.armorClass = 12
        character.hitPointsMax = 28
        character.hitPointsCurrent = 28
        Characters.saveCharacter(character)
        
        // Navigate to characters view
        await click('#menu-btn')
        await tick()
        await click('#menu-characters')
        await tick()
        
        expect(exists('.character-card')).toBe(true)
        const content = getText('#characters-list')
        expect(content).toContain('Test Wizard')
        expect(content).toContain('Wizard 5')
    })

    it('opens character view when clicking view in context menu', async () => {
        // Create a character with ability scores and skills
        const character = Characters.createEmptyCharacter()
        character.name = 'Gandalf the Grey'
        character.class = 'Wizard'
        character.level = 10
        character.abilities = { str: 10, dex: 14, con: 12, int: 18, wis: 16, cha: 14 }
        character.skillProficiencies = { arcana: true, history: true, perception: true }
        character.armorClass = 15
        character.hitPointsMax = 52
        character.hitPointsCurrent = 52
        Characters.saveCharacter(character)
        
        // Navigate to characters view
        await click('#menu-btn')
        await tick()
        await click('#menu-characters')
        await tick()
        
        // Click on character card to open context menu
        const card = document.querySelector('.character-card')
        expect(card).toBeTruthy()
        await click(card)
        await tick()
        
        // Click view action
        await click('#character-context-menu [data-action="view"]')
        await tick()
        
        // Verify character view is active and shows character data
        expect(exists('#character-view-section.active')).toBe(true)
        const viewContent = getText('#character-view-content')
        expect(viewContent).toContain('Gandalf the Grey')
        expect(viewContent).toContain('Wizard')
        
        // Verify ability scores are displayed
        expect(viewContent).toContain('18') // INT score
        expect(viewContent).toContain('+4') // INT modifier
        
        // Verify skills section is rendered with skill names
        expect(viewContent).toContain('Arcana')
        expect(viewContent).toContain('History')
        expect(viewContent).toContain('Perception')
    })
})

describe('Skills Configuration', () => {
    it('has all 18 D&D skills defined', () => {
        const skillCount = Object.keys(Characters.SKILLS).length
        expect(skillCount).toBe(18)
    })

    it('maps skills to correct abilities', () => {
        expect(Characters.SKILLS.acrobatics).toBe('dex')
        expect(Characters.SKILLS.athletics).toBe('str')
        expect(Characters.SKILLS.arcana).toBe('int')
        expect(Characters.SKILLS.perception).toBe('wis')
        expect(Characters.SKILLS.persuasion).toBe('cha')
        expect(Characters.SKILLS.medicine).toBe('wis')
    })

    it('has display names for all skills', () => {
        const skillKeys = Object.keys(Characters.SKILLS)
        const nameKeys = Object.keys(Characters.SKILL_NAMES)
        
        expect(nameKeys.length).toBe(skillKeys.length)
        skillKeys.forEach(key => {
            expect(Characters.SKILL_NAMES[key]).toBeDefined()
        })
    })
})

describe('Character HP', () => {
    beforeEach(async () => {
        await initApp()
    })

    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    describe('getEffectiveMaxHp', () => {
        it('returns max HP when no reduction', () => {
            const character = Characters.createEmptyCharacter()
            character.hitPointsMax = 50
            character.hitPointsMaxReduction = 0
            
            expect(Characters.getEffectiveMaxHp(character)).toBe(50)
        })

        it('subtracts reduction from max HP', () => {
            const character = Characters.createEmptyCharacter()
            character.hitPointsMax = 50
            character.hitPointsMaxReduction = 10
            
            expect(Characters.getEffectiveMaxHp(character)).toBe(40)
        })

        it('returns 0 if reduction exceeds max HP', () => {
            const character = Characters.createEmptyCharacter()
            character.hitPointsMax = 30
            character.hitPointsMaxReduction = 50
            
            expect(Characters.getEffectiveMaxHp(character)).toBe(0)
        })

        it('handles missing reduction field', () => {
            const character = Characters.createEmptyCharacter()
            character.hitPointsMax = 50
            delete character.hitPointsMaxReduction
            
            expect(Characters.getEffectiveMaxHp(character)).toBe(50)
        })
    })

    describe('HP Modal', () => {
        it('opens HP modal when clicking HP in character view', async () => {
            // Create a character
            const character = Characters.createEmptyCharacter()
            character.name = 'HP Test Character'
            character.hitPointsMax = 50
            character.hitPointsCurrent = 45
            character.hitPointsTemp = 5
            character.hitPointsMaxReduction = 0
            Characters.saveCharacter(character)
            
            // Navigate to characters view
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            // Click on character card to open context menu
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            
            // Click view action
            await click('#character-context-menu [data-action="view"]')
            await tick()
            
            // Click on HP section to open modal
            const hpSection = document.querySelector('.hp-clickable')
            expect(hpSection).toBeTruthy()
            await click(hpSection)
            await tick()
            
            // Verify modal is open (uses shared #hp-modal)
            expect(exists('#hp-modal.active')).toBe(true)
            
            // Verify modal displays correct values
            expect(document.getElementById('current-hp').textContent).toBe('45')
            expect(document.getElementById('hp-temp-input').value).toBe('5')
            expect(document.getElementById('max-hp').textContent).toBe('50')
            
            // Verify character fields are shown
            expect(exists('#hp-character-fields.hidden')).toBe(false)
        })

        it('saves HP changes from modal', async () => {
            // Create a character
            const character = Characters.createEmptyCharacter()
            character.name = 'HP Save Test'
            character.hitPointsMax = 100
            character.hitPointsCurrent = 100
            character.hitPointsTemp = 0
            character.hitPointsMaxReduction = 0
            Characters.saveCharacter(character)
            
            // Navigate to character view
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="view"]')
            await tick()
            
            // Open HP modal
            await click('.hp-clickable')
            await tick()
            
            // First set temp HP (won't affect current HP)
            document.getElementById('hp-temp-input').value = '10'
            document.getElementById('hp-temp-input').dispatchEvent(new Event('input'))
            await tick()
            
            // Set damage amount (-25)
            const hpInput = document.getElementById('hp-custom-amount')
            hpInput.value = '-25'
            hpInput.dispatchEvent(new Event('input'))
            await tick()
            
            // Set max reduction (this caps current HP to 95)
            document.getElementById('hp-max-reduction').value = '5'
            document.getElementById('hp-max-reduction').dispatchEvent(new Event('input'))
            await tick()
            
            // Save (uses Apply button which saves for characters)
            await click('#hp-apply-btn')
            await tick()
            
            // Verify character was updated:
            // - Max reduction 5 caps current HP from 100 to 95
            // - 25 damage: 10 absorbed by temp HP, 15 hits current HP
            // - Final: 95 - 15 = 80 HP, temp HP reduced from 10 to 0
            const updated = Characters.getCharacter(character.id)
            expect(updated.hitPointsCurrent).toBe(80)
            expect(updated.hitPointsTemp).toBe(0)  // temp HP absorbed 10 damage
            expect(updated.hitPointsMaxReduction).toBe(5)
        })

        it('displays max HP reduction in character view', async () => {
            // Create a character with max HP reduction
            const character = Characters.createEmptyCharacter()
            character.name = 'Reduced HP Test'
            character.hitPointsMax = 50
            character.hitPointsCurrent = 35
            character.hitPointsMaxReduction = 10
            Characters.saveCharacter(character)
            
            // Navigate to character view
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="view"]')
            await tick()
            
            // Verify effective max HP is displayed (50 - 10 = 40)
            const hpMax = document.querySelector('.hp-max')
            expect(hpMax.textContent).toBe('40')
            
            // Verify reduction note is displayed
            const reductionNote = document.querySelector('.hp-reduction-note')
            expect(reductionNote).toBeTruthy()
            expect(reductionNote.textContent).toContain('-10')
        })
    })
})
