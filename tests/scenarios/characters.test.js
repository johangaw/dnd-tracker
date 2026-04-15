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

        it('shows character sheet with updated HP after modal save', async () => {
            // Create a character
            const character = Characters.createEmptyCharacter()
            character.name = 'HP Update View Test'
            character.hitPointsMax = 50
            character.hitPointsCurrent = 50
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
            
            // Verify initial HP display
            expect(document.querySelector('.hp-current').textContent).toBe('50')
            expect(document.querySelector('.hp-max').textContent).toBe('50')
            
            // Open HP modal
            await click('.hp-clickable')
            await tick()
            
            // Verify modal is open
            expect(exists('#hp-modal.active')).toBe(true)
            
            // Apply 15 damage
            const hpInput = document.getElementById('hp-custom-amount')
            hpInput.value = '-15'
            hpInput.dispatchEvent(new Event('input'))
            await tick()
            
            // Save and close modal
            await click('#hp-apply-btn')
            await tick()
            
            // Verify modal is closed
            expect(exists('#hp-modal.active')).toBe(false)
            
            // Verify character view is still visible
            expect(exists('#character-view-section.active')).toBe(true)
            
            // Verify character sheet shows updated HP values
            expect(document.querySelector('.hp-current').textContent).toBe('35')
            expect(document.querySelector('.hp-max').textContent).toBe('50')
            
            // Verify the character name is still displayed (confirms we're on the right view)
            expect(document.querySelector('.character-name').textContent).toBe('HP Update View Test')
        })

        it('shows updated temp HP in character sheet after modal save', async () => {
            // Create a character
            const character = Characters.createEmptyCharacter()
            character.name = 'Temp HP View Test'
            character.hitPointsMax = 30
            character.hitPointsCurrent = 30
            character.hitPointsTemp = 0
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
            
            // Verify no temp HP initially
            expect(document.querySelector('.hp-temp')).toBeFalsy()
            
            // Open HP modal and add temp HP
            await click('.hp-clickable')
            await tick()
            
            document.getElementById('hp-temp-input').value = '8'
            document.getElementById('hp-temp-input').dispatchEvent(new Event('input'))
            await tick()
            
            // Save and close modal
            await click('#hp-apply-btn')
            await tick()
            
            // Verify character sheet shows temp HP
            const tempHpElement = document.querySelector('.hp-temp')
            expect(tempHpElement).toBeTruthy()
            expect(tempHpElement.textContent).toContain('8')
        })

        it('shows updated max HP reduction in character sheet after modal save', async () => {
            // Create a character
            const character = Characters.createEmptyCharacter()
            character.name = 'Max Reduction View Test'
            character.hitPointsMax = 40
            character.hitPointsCurrent = 40
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
            
            // Verify no reduction note initially
            expect(document.querySelector('.hp-reduction-note')).toBeFalsy()
            expect(document.querySelector('.hp-max').textContent).toBe('40')
            
            // Open HP modal and add max HP reduction
            await click('.hp-clickable')
            await tick()
            
            document.getElementById('hp-max-reduction').value = '10'
            document.getElementById('hp-max-reduction').dispatchEvent(new Event('input'))
            await tick()
            
            // Save and close modal
            await click('#hp-apply-btn')
            await tick()
            
            // Verify character sheet shows reduced max HP
            expect(document.querySelector('.hp-max').textContent).toBe('30')
            
            // Verify reduction note is displayed
            const reductionNote = document.querySelector('.hp-reduction-note')
            expect(reductionNote).toBeTruthy()
            expect(reductionNote.textContent).toContain('-10')
            
            // Current HP should be capped to effective max
            expect(document.querySelector('.hp-current').textContent).toBe('30')
        })
    })

    describe('Spell Slot Click Functionality', () => {
        it('displays spell slot circles correctly', async () => {
            // Create a character with spell slots
            const character = Characters.createEmptyCharacter()
            character.name = 'Spell Slot Test Wizard'
            character.class = 'Wizard'
            character.level = 5
            character.spellSlots = {
                1: { total: 4, used: 1 },
                2: { total: 3, used: 0 },
                3: { total: 2, used: 2 }
            }
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
            
            // Verify spell slots container exists
            expect(exists('.spell-slots-container')).toBe(true)
            
            // Verify level 1 slots: 3 available (filled), 1 used (empty)
            const level1Item = document.querySelector('.spell-slot-item[data-level="1"]')
            expect(level1Item).toBeTruthy()
            const level1Available = level1Item.querySelectorAll('.spell-slot-circle.available')
            const level1Used = level1Item.querySelectorAll('.spell-slot-circle.used')
            expect(level1Available.length).toBe(3)
            expect(level1Used.length).toBe(1)
            
            // Verify level 2 slots: 3 available, 0 used
            const level2Item = document.querySelector('.spell-slot-item[data-level="2"]')
            expect(level2Item).toBeTruthy()
            const level2Available = level2Item.querySelectorAll('.spell-slot-circle.available')
            const level2Used = level2Item.querySelectorAll('.spell-slot-circle.used')
            expect(level2Available.length).toBe(3)
            expect(level2Used.length).toBe(0)
            
            // Verify level 3 slots: 0 available, 2 used
            const level3Item = document.querySelector('.spell-slot-item[data-level="3"]')
            expect(level3Item).toBeTruthy()
            const level3Available = level3Item.querySelectorAll('.spell-slot-circle.available')
            const level3Used = level3Item.querySelectorAll('.spell-slot-circle.used')
            expect(level3Available.length).toBe(0)
            expect(level3Used.length).toBe(2)
        })

        it('expends a spell slot when clicking slot item and confirming', async () => {
            // Create a character with spell slots (all available, none used)
            const character = Characters.createEmptyCharacter()
            character.name = 'Expend Slot Test'
            character.class = 'Wizard'
            character.level = 3
            character.spellSlots = {
                1: { total: 4, used: 0 },
                2: { total: 2, used: 0 }
            }
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
            
            // Mock confirm to return true
            const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)
            
            // Click the spell slot item (entire row) to expend it
            const slotItem = document.querySelector('.spell-slot-item[data-level="1"]')
            expect(slotItem).toBeTruthy()
            await click(slotItem)
            await tick()
            
            // Verify confirm was called
            expect(confirmMock).toHaveBeenCalledWith('Expend a Level 1 spell slot?')
            
            // Verify the slot was expended (now 3 available, 1 used)
            const level1Item = document.querySelector('.spell-slot-item[data-level="1"]')
            const level1Available = level1Item.querySelectorAll('.spell-slot-circle.available')
            const level1Used = level1Item.querySelectorAll('.spell-slot-circle.used')
            expect(level1Available.length).toBe(3)
            expect(level1Used.length).toBe(1)
            
            // Verify character was saved
            const updated = Characters.getCharacter(character.id)
            expect(updated.spellSlots[1].used).toBe(1)
            
            confirmMock.mockRestore()
        })

        it('does not expend spell slot when clicking slot item and canceling', async () => {
            // Create a character with spell slots (all available)
            const character = Characters.createEmptyCharacter()
            character.name = 'Cancel Expend Test'
            character.class = 'Wizard'
            character.level = 3
            character.spellSlots = {
                1: { total: 4, used: 0 }
            }
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
            
            // Mock confirm to return false (cancel)
            const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false)
            
            // Click the spell slot item
            const slotItem = document.querySelector('.spell-slot-item[data-level="1"]')
            await click(slotItem)
            await tick()
            
            // Verify confirm was called
            expect(confirmMock).toHaveBeenCalled()
            
            // Verify the slot was NOT expended (still 4 available, 0 used)
            const level1Item = document.querySelector('.spell-slot-item[data-level="1"]')
            const level1Available = level1Item.querySelectorAll('.spell-slot-circle.available')
            const level1Used = level1Item.querySelectorAll('.spell-slot-circle.used')
            expect(level1Available.length).toBe(4)
            expect(level1Used.length).toBe(0)
            
            // Verify character was NOT modified
            const updated = Characters.getCharacter(character.id)
            expect(updated.spellSlots[1].used).toBe(0)
            
            confirmMock.mockRestore()
        })

        it('does nothing when clicking slot item with all slots used', async () => {
            // Create a character with all slots used
            const character = Characters.createEmptyCharacter()
            character.name = 'All Used Test'
            character.class = 'Wizard'
            character.level = 3
            character.spellSlots = {
                1: { total: 4, used: 4 }
            }
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
            
            // Mock confirm
            const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)
            
            // Click the spell slot item (all used - should do nothing)
            const slotItem = document.querySelector('.spell-slot-item[data-level="1"]')
            await click(slotItem)
            await tick()
            
            // Verify confirm was NOT called (no slots available to expend)
            expect(confirmMock).not.toHaveBeenCalled()
            
            // Verify slots unchanged
            const level1Item = document.querySelector('.spell-slot-item[data-level="1"]')
            const level1Available = level1Item.querySelectorAll('.spell-slot-circle.available')
            const level1Used = level1Item.querySelectorAll('.spell-slot-circle.used')
            expect(level1Available.length).toBe(0)
            expect(level1Used.length).toBe(4)
            
            confirmMock.mockRestore()
        })

        it('uses correct Level labels in confirmation messages', async () => {
            // Create a character with slots at various levels (all available)
            const character = Characters.createEmptyCharacter()
            character.name = 'Level Label Test'
            character.class = 'Wizard'
            character.level = 20
            character.spellSlots = {
                1: { total: 4, used: 0 },
                2: { total: 3, used: 0 },
                3: { total: 3, used: 0 },
                4: { total: 1, used: 0 }
            }
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
            
            const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false)
            
            // Test Level 1
            await click(document.querySelector('.spell-slot-item[data-level="1"]'))
            await tick()
            expect(confirmMock).toHaveBeenCalledWith('Expend a Level 1 spell slot?')
            
            // Test Level 2
            await click(document.querySelector('.spell-slot-item[data-level="2"]'))
            await tick()
            expect(confirmMock).toHaveBeenCalledWith('Expend a Level 2 spell slot?')
            
            // Test Level 3
            await click(document.querySelector('.spell-slot-item[data-level="3"]'))
            await tick()
            expect(confirmMock).toHaveBeenCalledWith('Expend a Level 3 spell slot?')
            
            // Test Level 4
            await click(document.querySelector('.spell-slot-item[data-level="4"]'))
            await tick()
            expect(confirmMock).toHaveBeenCalledWith('Expend a Level 4 spell slot?')
            
            confirmMock.mockRestore()
        })

        it('does not show spell slots container when character has no spell slots', async () => {
            // Create a character without spell slots (e.g., a Fighter)
            const character = Characters.createEmptyCharacter()
            character.name = 'No Spells Fighter'
            character.class = 'Fighter'
            character.level = 5
            // No spellSlots property
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
            
            // Verify spell slots container does NOT exist
            expect(exists('.spell-slots-container')).toBe(false)
        })
    })

    describe('Spell Picker', () => {
        it('opens spell picker modal when clicking Add Cantrip button', async () => {
            // Create and edit a character
            const character = Characters.createEmptyCharacter()
            character.name = 'Spell Picker Test'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Click Add Cantrip button
            await click('#add-cantrip-btn')
            await tick()
            
            // Verify spell picker modal is open
            expect(exists('#spell-picker-modal.active')).toBe(true)
            expect(getText('#spell-picker-title')).toBe('Select Cantrip')
            
            // Verify level filter is set to cantrips and disabled
            const levelFilter = document.getElementById('spell-level-filter')
            expect(levelFilter.value).toBe('0')
            expect(levelFilter.disabled).toBe(true)
        })

        it('opens spell picker modal when clicking Add Spell button', async () => {
            // Create and edit a character
            const character = Characters.createEmptyCharacter()
            character.name = 'Spell Picker Test'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Click Add Spell button
            await click('#add-spell-btn')
            await tick()
            
            // Verify spell picker modal is open
            expect(exists('#spell-picker-modal.active')).toBe(true)
            expect(getText('#spell-picker-title')).toBe('Select Spell')
            
            // Verify level filter is NOT disabled for regular spells
            const levelFilter = document.getElementById('spell-level-filter')
            expect(levelFilter.disabled).toBe(false)
        })

        it('filters spells by search query', async () => {
            // Create and edit a character
            const character = Characters.createEmptyCharacter()
            character.name = 'Spell Search Test'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open spell picker
            await click('#add-spell-btn')
            await tick()
            
            // Type exact search query to get single result
            const searchInput = document.getElementById('spell-search-input')
            searchInput.value = 'magic missile'
            searchInput.dispatchEvent(new Event('input', { bubbles: true }))
            await tick()
            
            // Verify Magic Missile is shown in results
            const results = document.querySelectorAll('.spell-result-item')
            expect(results.length).toBe(1)
            expect(results[0].querySelector('.spell-result-name').textContent).toBe('Magic Missile')
        })

        it('filters spells by level', async () => {
            // Create and edit a character
            const character = Characters.createEmptyCharacter()
            character.name = 'Spell Level Filter Test'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open spell picker
            await click('#add-spell-btn')
            await tick()
            
            // Select 9th level filter
            const levelFilter = document.getElementById('spell-level-filter')
            levelFilter.value = '9'
            levelFilter.dispatchEvent(new Event('change', { bubbles: true }))
            await tick()
            
            // Verify only 9th level spells are shown
            const results = document.querySelectorAll('.spell-result-item')
            results.forEach(result => {
                const levelBadge = result.querySelector('.spell-result-level')
                expect(levelBadge.textContent).toBe('9th')
            })
        })

        it('adds selected spell to character', async () => {
            // Create and edit a character
            const character = Characters.createEmptyCharacter()
            character.name = 'Spell Add Test'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open spell picker
            await click('#add-spell-btn')
            await tick()
            
            // Search for Fireball
            const searchInput = document.getElementById('spell-search-input')
            searchInput.value = 'fireball'
            searchInput.dispatchEvent(new Event('input', { bubbles: true }))
            await tick()
            
            // Click on Fireball to select it
            await click('.spell-result-item')
            await tick()
            
            // Verify modal is closed
            expect(exists('#spell-picker-modal.active')).toBe(false)
            
            // Verify spell is added to the list
            const spellsList = document.getElementById('spells-known-list')
            expect(spellsList.textContent).toContain('Fireball')
        })

        it('adds selected cantrip to character', async () => {
            // Create and edit a character
            const character = Characters.createEmptyCharacter()
            character.name = 'Cantrip Add Test'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open cantrip picker
            await click('#add-cantrip-btn')
            await tick()
            
            // Search for Fire Bolt
            const searchInput = document.getElementById('spell-search-input')
            searchInput.value = 'fire bolt'
            searchInput.dispatchEvent(new Event('input', { bubbles: true }))
            await tick()
            
            // Click on Fire Bolt to select it
            await click('.spell-result-item')
            await tick()
            
            // Verify cantrip is added to the list
            const cantripsList = document.getElementById('cantrips-list')
            expect(cantripsList.textContent).toContain('Fire Bolt')
        })

        it('displays spell links to aidedd.org', async () => {
            // Create a character with spells
            const character = Characters.createEmptyCharacter()
            character.name = 'Spell Links Test'
            character.spellsKnown = ['Fireball', 'Lightning Bolt']
            character.cantripsKnown = ['Fire Bolt']
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Verify spell links have correct href
            const fireballLink = document.querySelector('#spells-known-list a[href*="fireball"]')
            expect(fireballLink).toBeDefined()
            expect(fireballLink.href).toContain('aidedd.org/spell/fireball')
            
            const fireboltLink = document.querySelector('#cantrips-list a[href*="fire-bolt"]')
            expect(fireboltLink).toBeDefined()
            expect(fireboltLink.href).toContain('aidedd.org/spell/fire-bolt')
        })

        it('prevents duplicate spells', async () => {
            // Create a character with Magic Missile already (no other matches)
            const character = Characters.createEmptyCharacter()
            character.name = 'No Duplicates Test'
            character.spellsKnown = ['Magic Missile']
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Verify Magic Missile is already shown
            let spellsList = document.getElementById('spells-known-list')
            let spellMatches = spellsList.querySelectorAll('a[href*="magic-missile"]')
            expect(spellMatches.length).toBe(1)
            
            // Open spell picker and try to add Magic Missile again
            await click('#add-spell-btn')
            await tick()
            
            const searchInput = document.getElementById('spell-search-input')
            searchInput.value = 'magic missile'
            searchInput.dispatchEvent(new Event('input', { bubbles: true }))
            await tick()
            
            // Should find exactly one result
            const results = document.querySelectorAll('.spell-result-item')
            expect(results.length).toBe(1)
            expect(results[0].dataset.spellName).toBe('Magic Missile')
            await click(results[0])
            await tick()
            
            // Verify there's still only one Magic Missile (duplicate was prevented)
            spellsList = document.getElementById('spells-known-list')
            spellMatches = spellsList.querySelectorAll('a[href*="magic-missile"]')
            expect(spellMatches.length).toBe(1)
        })

        it('closes spell picker with close button', async () => {
            // Create and edit a character
            const character = Characters.createEmptyCharacter()
            character.name = 'Close Modal Test'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open spell picker
            await click('#add-spell-btn')
            await tick()
            expect(exists('#spell-picker-modal.active')).toBe(true)
            
            // Click close button
            await click('#spell-picker-modal .close-modal')
            await tick()
            
            // Verify modal is closed
            expect(exists('#spell-picker-modal.active')).toBe(false)
        })

        it('shows class filter toggle for spellcasting classes', async () => {
            // Create a Wizard character
            const character = Characters.createEmptyCharacter()
            character.name = 'Class Filter Test'
            character.class = 'Wizard'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open spell picker
            await click('#add-spell-btn')
            await tick()
            
            // Verify class filter is visible and checked by default
            const classFilterContainer = document.getElementById('spell-class-filter-container')
            expect(classFilterContainer.style.display).toBe('block')
            
            const toggle = document.getElementById('spell-class-filter-toggle')
            expect(toggle.checked).toBe(true)
            
            // Verify label shows class name
            const label = document.getElementById('spell-class-filter-label')
            expect(label.textContent).toContain('Wizard')
        })

        it('hides class filter toggle for non-spellcasting classes', async () => {
            // Create a Fighter character (non-spellcaster)
            const character = Characters.createEmptyCharacter()
            character.name = 'Non-caster Test'
            character.class = 'Fighter'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open spell picker
            await click('#add-spell-btn')
            await tick()
            
            // Verify class filter is hidden
            const classFilterContainer = document.getElementById('spell-class-filter-container')
            expect(classFilterContainer.style.display).toBe('none')
        })

        it('filters spells by class when toggle is checked', async () => {
            // Create a Wizard character
            const character = Characters.createEmptyCharacter()
            character.name = 'Wizard Spell Filter Test'
            character.class = 'Wizard'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open spell picker
            await click('#add-spell-btn')
            await tick()
            
            // Toggle should be checked by default, showing only Wizard spells
            // Search for Fireball (a Wizard spell)
            const searchInput = document.getElementById('spell-search-input')
            searchInput.value = 'fireball'
            searchInput.dispatchEvent(new Event('input', { bubbles: true }))
            await tick()
            
            // Fireball should be found
            let results = document.querySelectorAll('.spell-result-item')
            expect(results.length).toBeGreaterThan(0)
            
            // Search for Healing Word (NOT a Wizard spell)
            searchInput.value = 'healing word'
            searchInput.dispatchEvent(new Event('input', { bubbles: true }))
            await tick()
            
            // Healing Word should NOT be found when filtered to Wizard spells
            results = document.querySelectorAll('.spell-result-item')
            expect(results.length).toBe(0)
        })

        it('shows all spells when class filter toggle is unchecked', async () => {
            // Create a Wizard character
            const character = Characters.createEmptyCharacter()
            character.name = 'Unfiltered Spell Test'
            character.class = 'Wizard'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open spell picker
            await click('#add-spell-btn')
            await tick()
            
            // Uncheck the class filter toggle
            const toggle = document.getElementById('spell-class-filter-toggle')
            toggle.checked = false
            toggle.dispatchEvent(new Event('change', { bubbles: true }))
            await tick()
            
            // Search for Healing Word (NOT a Wizard spell)
            const searchInput = document.getElementById('spell-search-input')
            searchInput.value = 'healing word'
            searchInput.dispatchEvent(new Event('input', { bubbles: true }))
            await tick()
            
            // Healing Word SHOULD be found when class filter is off
            const results = document.querySelectorAll('.spell-result-item')
            expect(results.length).toBeGreaterThan(0)
        })

        it('includes subclass spells when filtering', async () => {
            // Create a Cleric with Life Domain
            const character = Characters.createEmptyCharacter()
            character.name = 'Subclass Spell Test'
            character.class = 'Cleric'
            character.subclass = 'Life Domain'
            Characters.saveCharacter(character)
            
            // Navigate to character edit
            await click('#menu-btn')
            await tick()
            await click('#menu-characters')
            await tick()
            
            const card = document.querySelector('.character-card')
            await click(card)
            await tick()
            await click('#character-context-menu [data-action="edit"]')
            await tick()
            
            // Open spell picker
            await click('#add-spell-btn')
            await tick()
            
            // Verify label shows subclass
            const label = document.getElementById('spell-class-filter-label')
            expect(label.textContent).toContain('Life Domain')
            
            // Search for Beacon of Hope (Life Domain spell)
            const searchInput = document.getElementById('spell-search-input')
            searchInput.value = 'beacon of hope'
            searchInput.dispatchEvent(new Event('input', { bubbles: true }))
            await tick()
            
            // Beacon of Hope should be found (it's both on Cleric list AND Life Domain list)
            const results = document.querySelectorAll('.spell-result-item')
            expect(results.length).toBe(1)
        })
    })
})
