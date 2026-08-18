// Tests for Custom Monsters feature
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
    initApp, click, type, clearAndType, submitForm, tick,
    exists, isVisible, getText, getAll, count, getValue,
    setupFetchMock, reloadApp, longPress
} from '../helpers.js'
import * as CustomMonsters from '../../js/services/customMonsters.js'
import * as MonsterAPI from '../../js/services/monsterApi.js'

describe('Custom Monsters', () => {
    beforeEach(async () => {
        await initApp()
    })

    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    describe('Custom Monsters Service', () => {
        it('creates an empty monster with default values', () => {
            const monster = CustomMonsters.createEmptyMonster()
            
            expect(monster.id).toBeDefined()
            expect(monster.name).toBe('')
            expect(monster.source).toBe('Custom')
            expect(monster.size).toEqual(['M'])
            expect(monster.type).toBe('humanoid')
            expect(monster.str).toBe(10)
            expect(monster.hp.average).toBe(10)
            expect(monster.isCustom).toBe(true)
        })

        it('saves and retrieves custom monsters', () => {
            const monster = CustomMonsters.createEmptyMonster()
            monster.name = 'Test Monster'
            
            CustomMonsters.saveCustomMonster(monster)
            
            const retrieved = CustomMonsters.getCustomMonster(monster.id)
            expect(retrieved).toBeTruthy()
            expect(retrieved.name).toBe('Test Monster')
        })

        it('deletes custom monsters', () => {
            const monster = CustomMonsters.createEmptyMonster()
            monster.name = 'To Delete'
            CustomMonsters.saveCustomMonster(monster)
            
            expect(CustomMonsters.getCustomMonster(monster.id)).toBeTruthy()
            
            CustomMonsters.deleteCustomMonster(monster.id)
            
            expect(CustomMonsters.getCustomMonster(monster.id)).toBeFalsy()
        })

        it('searches custom monsters by name', () => {
            // Clear any existing monsters first
            localStorage.removeItem('dnd-custom-monsters')
            
            const monster1 = CustomMonsters.createEmptyMonster()
            monster1.name = 'Fire Dragon'
            monster1.id = 'test-monster-1'  // Use fixed ID to avoid timing issues
            CustomMonsters.saveCustomMonster(monster1)
            
            const monster2 = CustomMonsters.createEmptyMonster()
            monster2.name = 'Ice Elemental'
            monster2.id = 'test-monster-2'  // Use fixed ID to avoid timing issues
            CustomMonsters.saveCustomMonster(monster2)
            
            // Verify monsters were saved
            const allMonsters = CustomMonsters.getCustomMonsters()
            expect(allMonsters.length).toBe(2)
            
            const results = CustomMonsters.searchCustomMonsters('dragon')
            expect(results.length).toBe(1)
            expect(results[0].name).toBe('Fire Dragon')
        })

        it('creates monster from baseline', () => {
            const baseMonster = {
                name: 'Goblin',
                source: 'MM',
                size: ['S'],
                type: 'humanoid',
                hp: { average: 7 },
                ac: [{ ac: 15 }],
                cr: '1/4'
            }
            
            const custom = CustomMonsters.createFromBaseline(baseMonster)
            
            expect(custom.name).toBe('Goblin (Custom)')
            expect(custom.source).toBe('Custom')
            expect(custom.baselineName).toBe('Goblin')
            expect(custom.baselineSource).toBe('MM')
            expect(custom.hp.average).toBe(7)
            expect(custom.isCustom).toBe(true)
        })

        it('imports monster from JSON', () => {
            const json = JSON.stringify({
                name: 'Imported Monster',
                ac: [{ ac: 18 }],
                hp: { average: 100 },
                str: 20
            })
            
            const monster = CustomMonsters.importMonsterFromJSON(json)
            
            expect(monster.name).toBe('Imported Monster')
            expect(monster.str).toBe(20)
            expect(monster.isCustom).toBe(true)
        })

        it('throws error for invalid JSON import', () => {
            expect(() => {
                CustomMonsters.importMonsterFromJSON('not valid json')
            }).toThrow()
        })

        it('throws error for JSON without name', () => {
            expect(() => {
                CustomMonsters.importMonsterFromJSON('{"hp": {"average": 10}}')
            }).toThrow('Monster must have a name')
        })

        it('exports monster to URL', async () => {
            const monster = CustomMonsters.createEmptyMonster()
            monster.name = 'Share Me'
            
            const url = await CustomMonsters.exportMonsterToURL(monster)
            
            expect(url).toContain('?importMonster=')
        })
    })

    describe('Navigation', () => {
        it('shows app menu when menu button is clicked', async () => {
            await click('#menu-btn')
            
            expect(isVisible('#app-menu')).toBe(true)
        })

        it('navigates to custom monsters view from menu', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            
            expect(document.getElementById('custom-monsters-view').classList.contains('active')).toBe(true)
        })

        it('shows empty state when no custom monsters exist', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            
            // Check for the custom monsters empty state (not encounters)
            const customMonstersList = document.getElementById('custom-monsters-list')
            expect(customMonstersList.textContent).toContain('No Custom Monsters')
        })

        it('shows back button in custom monsters view', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            
            expect(isVisible('#back-btn')).toBe(true)
        })

        it('returns to encounter list when back is clicked from custom monsters', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('#back-btn')
            
            expect(document.getElementById('encounter-list-view').classList.contains('active')).toBe(true)
        })
    })

    describe('Create Custom Monster', () => {
        it('shows new monster form when FAB is clicked', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('#new-custom-monster-btn')
            await click('#choice-create-new')
            
            expect(document.getElementById('custom-monster-edit-view').classList.contains('active')).toBe(true)
        })

        it('saves a new custom monster', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('#new-custom-monster-btn')
            await click('#choice-create-new')
            
            // Fill in the form
            await type('#monster-name', 'Test Dragon')
            await clearAndType('#monster-hp', '150')
            await clearAndType('#monster-ac', '18')
            
            // Save
            await submitForm('#custom-monster-form')
            
            // Should return to list
            expect(document.getElementById('custom-monsters-view').classList.contains('active')).toBe(true)
            
            // Monster should appear in list
            expect(document.body.textContent).toContain('Test Dragon')
            
            // Should be saved to storage
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters.length).toBe(1)
            expect(monsters[0].name).toBe('Test Dragon')
        })

        it('requires monster name', async () => {
            // Mock alert
            const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
            
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('#new-custom-monster-btn')
            await click('#choice-create-new')
            
            // Don't fill in name, just try to save
            await submitForm('#custom-monster-form')
            
            // Should show alert
            expect(alertMock).toHaveBeenCalledWith('Monster name is required')
            
            // Should still be on edit view
            expect(document.getElementById('custom-monster-edit-view').classList.contains('active')).toBe(true)
        })

        it('adds traits to monster', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('#new-custom-monster-btn')
            await click('#choice-create-new')
            
            await type('#monster-name', 'Trait Monster')
            await click('#add-trait-btn')
            
            // Should have trait form fields
            expect(exists('.trait-item')).toBe(true)
            expect(exists('.trait-name')).toBe(true)
            
            // Fill in trait
            await type('.trait-name', 'Pack Tactics')
            await type('.trait-desc', 'Gains advantage when ally is adjacent')
            
            await submitForm('#custom-monster-form')
            
            // Check saved monster has trait
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters[0].trait.length).toBe(1)
            expect(monsters[0].trait[0].name).toBe('Pack Tactics')
        })

        it('adds actions to monster', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('#new-custom-monster-btn')
            await click('#choice-create-new')
            
            await type('#monster-name', 'Action Monster')
            await click('#add-action-btn')
            
            // Should have action form fields
            expect(exists('.action-item')).toBe(true)
            expect(exists('.action-name')).toBe(true)
            
            // Fill in action
            await type('.action-name', 'Multiattack')
            await type('.action-desc', 'Makes two claw attacks')
            
            await submitForm('#custom-monster-form')
            
            // Check saved monster has action
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters[0].action.length).toBe(1)
            expect(monsters[0].action[0].name).toBe('Multiattack')
        })

        it('adds bonus actions to monster', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('#new-custom-monster-btn')
            await click('#choice-create-new')
            
            await type('#monster-name', 'Bonus Monster')
            await click('#add-bonus-btn')
            
            // Should have bonus action form fields
            expect(exists('.bonus-item')).toBe(true)
            expect(exists('.bonus-name')).toBe(true)
            
            // Fill in bonus action
            await type('.bonus-name', 'Cunning Action')
            await type('.bonus-desc', 'Can Dash, Disengage, or Hide as a bonus action')
            
            await submitForm('#custom-monster-form')
            
            // Check saved monster has bonus action
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters[0].bonus.length).toBe(1)
            expect(monsters[0].bonus[0].name).toBe('Cunning Action')
        })

        it('adds reactions to monster', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('#new-custom-monster-btn')
            await click('#choice-create-new')
            
            await type('#monster-name', 'Reaction Monster')
            await click('#add-reaction-btn')
            
            // Should have reaction form fields
            expect(exists('.reaction-item')).toBe(true)
            expect(exists('.reaction-name')).toBe(true)
            
            // Fill in reaction
            await type('.reaction-name', 'Parry')
            await type('.reaction-desc', 'Adds 2 to AC against one melee attack')
            
            await submitForm('#custom-monster-form')
            
            // Check saved monster has reaction
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters[0].reaction.length).toBe(1)
            expect(monsters[0].reaction[0].name).toBe('Parry')
        })

        it('adds spellcasting to monster', async () => {
            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('#new-custom-monster-btn')
            await click('#choice-create-new')
            
            await type('#monster-name', 'Spellcasting Monster')
            await click('#add-spellcasting-btn')
            
            // Should have spellcasting form fields
            expect(exists('.spellcasting-item')).toBe(true)
            expect(exists('.spellcasting-name')).toBe(true)
            expect(exists('.spellcasting-header')).toBe(true)
            expect(exists('.spellcasting-spells')).toBe(true)
            
            // Fill in spellcasting
            await type('.spellcasting-name', 'Innate Spellcasting')
            await type('.spellcasting-header', 'The creature can cast spells using Charisma (spell save DC 15).')
            await type('.spellcasting-spells', 'At will: detect magic, light\n1/day each: fireball, lightning bolt')
            
            await submitForm('#custom-monster-form')
            
            // Check saved monster has spellcasting
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters[0].spellcasting.length).toBe(1)
            expect(monsters[0].spellcasting[0].name).toBe('Innate Spellcasting')
            expect(monsters[0].spellcasting[0].will).toContain('detect magic')
            expect(monsters[0].spellcasting[0].daily['1e']).toContain('fireball')
        })
    })

    describe('Edit Custom Monster', () => {
        beforeEach(async () => {
            // Seed a custom monster
            const monster = CustomMonsters.createEmptyMonster()
            monster.name = 'Existing Monster'
            monster.hp = { average: 50 }
            CustomMonsters.saveCustomMonster(monster)
            
            // Navigate to custom monsters and refresh
            const { setView } = await import('../../js/services/state.js')
            const CustomMonsterList = await import('../../js/components/custom-monsters-view/index.js')
            setView('custom-monsters')
            CustomMonsterList.render()
            await tick()
        })

        it('shows monster cards in list', () => {
            expect(exists('.monster-card')).toBe(true)
            expect(document.body.textContent).toContain('Existing Monster')
        })

        it('shows context menu on monster click', async () => {
            await click('.monster-card')
            
            expect(isVisible('#monster-context-menu')).toBe(true)
        })

        it('opens edit view from context menu', async () => {
            await click('.monster-card')
            await click('#monster-context-menu [data-action="edit"]')
            
            expect(document.getElementById('custom-monster-edit-view').classList.contains('active')).toBe(true)
            expect(getValue('#monster-name')).toBe('Existing Monster')
        })

        it('shows delete button when editing existing monster', async () => {
            await click('.monster-card')
            await click('#monster-context-menu [data-action="edit"]')
            
            expect(isVisible('#delete-monster-btn')).toBe(true)
        })

        it('updates existing monster', async () => {
            await click('.monster-card')
            await click('#monster-context-menu [data-action="edit"]')
            
            await clearAndType('#monster-name', 'Updated Monster')
            await submitForm('#custom-monster-form')
            
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters[0].name).toBe('Updated Monster')
        })

        it('deletes monster from edit view', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true)
            
            await click('.monster-card')
            await click('#monster-context-menu [data-action="edit"]')
            await click('#delete-monster-btn')
            
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters.length).toBe(0)
        })
    })

    describe('Context Menu Actions', () => {
        beforeEach(async () => {
            // Clear existing and create fresh monster
            localStorage.removeItem('dnd-custom-monsters')
            
            const monster = CustomMonsters.createEmptyMonster()
            monster.name = 'Context Monster'
            CustomMonsters.saveCustomMonster(monster)
            
            const { setView } = await import('../../js/services/state.js')
            const CustomMonsterList = await import('../../js/components/custom-monsters-view/index.js')
            setView('custom-monsters')
            CustomMonsterList.render()
            await tick()
        })

        it('duplicates monster', async () => {
            await click('.monster-card')
            // Use the monster context menu specifically
            const monsterMenu = document.getElementById('monster-context-menu')
            await click(monsterMenu.querySelector('[data-action="copy"]'))
            
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters.length).toBe(2)
            expect(monsters.some(m => m.name === 'Context Monster (Copy)')).toBe(true)
        })

        it('shares monster link', async () => {
            const clipboardMock = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
            vi.spyOn(window, 'alert').mockImplementation(() => {})
            
            await click('.monster-card')
            const monsterMenu = document.getElementById('monster-context-menu')
            await click(monsterMenu.querySelector('[data-action="share"]'))
            
            expect(clipboardMock).toHaveBeenCalled()
            const url = clipboardMock.mock.calls[0][0]
            expect(url).toContain('?importMonster=')
        })

        it('deletes monster from context menu', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true)
            
            await click('.monster-card')
            const monsterMenu = document.getElementById('monster-context-menu')
            await click(monsterMenu.querySelector('[data-action="delete"]'))
            
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters.length).toBe(0)
        })
    })

    describe('Import JSON Modal', () => {
        it('opens import JSON modal from add button', async () => {
            await click('#new-custom-monster-btn')
            await click('#choice-import-json')
            
            expect(isVisible('#import-json-modal')).toBe(true)
        })

        it('imports monster from valid JSON', async () => {
            await click('#new-custom-monster-btn')
            await click('#choice-import-json')
            
            const json = JSON.stringify({
                name: 'JSON Monster',
                hp: { average: 75 },
                ac: [{ ac: 16 }]
            })
            
            await type('#import-json-input', json)
            await click('#import-json-confirm-btn')
            
            // Should navigate to custom monsters view
            expect(document.getElementById('custom-monsters-view').classList.contains('active')).toBe(true)
            
            // Monster should be saved
            const monsters = CustomMonsters.getCustomMonsters()
            expect(monsters.some(m => m.name === 'JSON Monster')).toBe(true)
        })

        it('shows error for invalid JSON', async () => {
            await click('#new-custom-monster-btn')
            await click('#choice-import-json')
            
            await type('#import-json-input', 'not valid json')
            await click('#import-json-confirm-btn')
            
            // Error should be visible
            expect(isVisible('#import-json-error')).toBe(true)
            
            // Modal should still be open
            expect(isVisible('#import-json-modal')).toBe(true)
        })

        it('closes modal on cancel', async () => {
            await click('#new-custom-monster-btn')
            await click('#choice-import-json')
            await click('#import-json-cancel-btn')
            
            expect(isVisible('#import-json-modal')).toBe(false)
        })

        it('shows choice modal when clicking add button', async () => {
            await click('#new-custom-monster-btn')
            
            expect(isVisible('#add-monster-choice-modal')).toBe(true)
        })

        it('opens create new from choice modal', async () => {
            await click('#new-custom-monster-btn')
            await click('#choice-create-new')
            
            expect(document.getElementById('custom-monster-edit-view').classList.contains('active')).toBe(true)
        })

        it('opens baseline search from choice modal', async () => {
            await click('#new-custom-monster-btn')
            await click('#choice-from-existing')
            
            expect(isVisible('#baseline-search-modal')).toBe(true)
        })

        it('matches the standard monster search modal layout and filter labels', async () => {
            await click('#new-custom-monster-btn')
            await click('#choice-from-existing')

            const filter = document.getElementById('baseline-source-filter')
            expect(document.querySelector('#baseline-search-modal .modal-hint')).toBeNull()
            expect(filter.innerHTML).toContain('Default')
            expect(filter.innerHTML).not.toContain('Core Books')
        })

        it('uses the same monster result UI for baseline searches as encounter searches', async () => {
            const monster = CustomMonsters.createEmptyMonster()
            monster.name = 'Goblin'
            monster.cr = '1/4'
            monster.hp = { average: 7 }
            CustomMonsters.saveCustomMonster(monster)

            await click('#new-custom-monster-btn')
            await click('#choice-from-existing')

            await type('#baseline-search-input', 'goblin')
            await tick(400)

            const result = document.querySelector('#baseline-search-results .search-result-item')
            expect(result).not.toBeNull()
            expect(document.querySelector('#baseline-search-results .search-result-info')).not.toBeNull()
            expect(document.querySelector('#baseline-search-results .view-stats-btn')).not.toBeNull()
        })
    })

    describe('Integration with Encounter Search', () => {
        beforeEach(async () => {
            // Create a custom monster
            const monster = CustomMonsters.createEmptyMonster()
            monster.name = 'Custom Goblin'
            monster.cr = '1/4'
            monster.hp = { average: 15 }
            CustomMonsters.saveCustomMonster(monster)
        })

        it('shows custom monsters in encounter monster search', async () => {
            // Create new encounter
            await click('#new-encounter-btn')
            await type('#encounter-title', 'Test Encounter')
            
            // Open monster search
            await click('#add-monster-btn')
            await tick(50)
            
            // Search for our custom monster
            await type('#monster-search-input', 'Custom')
            await tick(400) // Wait for debounce
            
            // Should find our custom monster
            expect(document.body.textContent).toContain('Custom Goblin')
        })

        it('filters to show only custom monsters', async () => {
            await click('#new-encounter-btn')
            await type('#encounter-title', 'Test Encounter')
            
            await click('#add-monster-btn')
            await tick(50)
            
            // Change filter to Custom
            const filter = document.getElementById('monster-source-filter')
            filter.value = 'Custom'
            const event = new Event('change')
            filter.dispatchEvent(event)
            await tick()
            
            // Search
            await type('#monster-search-input', 'goblin')
            await tick(400)
            
            // Should only show custom monsters
            const results = getAll('.search-result-item')
            results.forEach(result => {
                expect(result.textContent).toContain('Custom')
            })
        })

        it('includes custom monsters in All Sources search', async () => {
            await click('#new-encounter-btn')
            await type('#encounter-title', 'Test Encounter')

            await click('#add-monster-btn')
            await tick(50)

            const filter = document.getElementById('monster-source-filter')
            filter.value = 'ALL'
            filter.dispatchEvent(new Event('change'))
            await tick()

            await type('#monster-search-input', 'goblin')
            await tick(400)

            const results = getAll('.search-result-item')
            const labels = results.map(result => result.textContent)
            expect(labels.some(label => label.includes('Custom Goblin'))).toBe(true)
        })

        it('defaults monster search to XMM and excludes MM', async () => {
            vi.resetModules()
            const originalFetch = globalThis.fetch
            const calls = []
            globalThis.fetch = async (url) => {
                calls.push(url)
                if (url.includes('index.json')) {
                    return {
                        ok: true,
                        json: async () => ({ MM: 'bestiary-mm.json', XMM: 'bestiary-xmm.json' })
                    }
                }
                if (url.includes('bestiary-xmm.json')) {
                    return {
                        ok: true,
                        json: async () => ({ monster: [{ name: 'Goblin', source: 'XMM' }, { name: 'Skeleton', source: 'XMM' }] })
                    }
                }
                if (url.includes('bestiary-mm.json')) {
                    return {
                        ok: true,
                        json: async () => ({ monster: [{ name: 'Goblin', source: 'MM' }] })
                    }
                }
                return {
                    ok: true,
                    json: async () => ({ monster: [] })
                }
            }

            try {
                const freshMonsterApi = (await import('../../js/services/monsterApi.js')).default
                const defaultSources = freshMonsterApi.DEFAULT_SOURCES

                expect(defaultSources.includes('MM')).toBe(false)
                expect(defaultSources.includes('XMM')).toBe(true)

                const results = await freshMonsterApi.searchMonsters('goblin', '')
                expect(results.some(monster => monster.source === 'MM')).toBe(false)
                expect(results.some(monster => monster.source === 'XMM')).toBe(true)
                expect(calls.some(url => url.includes('bestiary-mm.json'))).toBe(false)
            } finally {
                globalThis.fetch = originalFetch
            }
        })

        it('adds custom monster to encounter', async () => {
            await click('#new-encounter-btn')
            await click('#encounter-choice-create-new')
            await type('#encounter-title', 'Test Encounter')
            
            await click('#add-monster-btn')
            await tick(50)
            
            await type('#monster-search-input', 'Custom Goblin')
            await tick(400)
            
            // Click to add the monster
            const result = document.querySelector('.search-result-info')
            if (result) {
                await click(result)
            }
            
            // Monster should be in the list
            expect(document.querySelector('#monster-list').textContent).toContain('Custom Goblin')
        })
    })

    describe('Stat Block Spellcasting', () => {
        it('renders spellcasting with at-will spells', async () => {
            const { renderStatBlock } = await import('../../js/components/modals/statBlock.js')
            
            const monster = {
                name: 'Mage',
                size: ['M'],
                type: 'humanoid',
                alignment: ['N'],
                ac: [{ ac: 12 }],
                hp: { average: 40 },
                speed: { walk: 30 },
                str: 10, dex: 14, con: 12, int: 17, wis: 12, cha: 11,
                cr: '6',
                spellcasting: [{
                    name: 'Innate Spellcasting',
                    type: 'spellcasting',
                    headerEntries: ['The mage can innately cast the following spells.'],
                    will: ['{@spell detect magic}', '{@spell light}']
                }]
            }
            
            const html = renderStatBlock(monster)
            
            expect(html).toContain('Innate Spellcasting')
            expect(html).toContain('At will:')
            expect(html).toContain('detect magic')
            expect(html).toContain('light')
        })

        it('renders spellcasting with daily spells', async () => {
            const { renderStatBlock } = await import('../../js/components/modals/statBlock.js')
            
            const monster = {
                name: 'Drow',
                size: ['M'],
                type: 'humanoid',
                alignment: ['N', 'E'],
                ac: [{ ac: 15 }],
                hp: { average: 45 },
                speed: { walk: 30 },
                str: 10, dex: 14, con: 10, int: 11, wis: 11, cha: 12,
                cr: '1',
                spellcasting: [{
                    name: 'Innate Spellcasting',
                    type: 'spellcasting',
                    headerEntries: ['The drow can cast spells using Charisma.'],
                    daily: {
                        '1e': ['{@spell darkness}', '{@spell faerie fire}']
                    }
                }]
            }
            
            const html = renderStatBlock(monster)
            
            expect(html).toContain('Innate Spellcasting')
            expect(html).toContain('1/day each:')
            expect(html).toContain('darkness')
            expect(html).toContain('faerie fire')
        })

        it('renders spellcasting with spell slots', async () => {
            const { renderStatBlock } = await import('../../js/components/modals/statBlock.js')
            
            const monster = {
                name: 'Wizard',
                size: ['M'],
                type: 'humanoid',
                alignment: ['N'],
                ac: [{ ac: 12 }],
                hp: { average: 40 },
                speed: { walk: 30 },
                str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 11,
                cr: '6',
                spellcasting: [{
                    name: 'Spellcasting',
                    type: 'spellcasting',
                    headerEntries: ['The wizard is a 9th-level spellcaster.'],
                    spells: {
                        '0': { spells: ['{@spell fire bolt}', '{@spell light}'] },
                        '1': { slots: 4, spells: ['{@spell magic missile}', '{@spell shield}'] },
                        '2': { slots: 3, spells: ['{@spell misty step}', '{@spell suggestion}'] }
                    }
                }]
            }
            
            const html = renderStatBlock(monster)
            
            expect(html).toContain('Spellcasting')
            expect(html).toContain('Cantrips (at will):')
            expect(html).toContain('fire bolt')
            expect(html).toContain('1st level (4 slots):')
            expect(html).toContain('magic missile')
            expect(html).toContain('2nd level (3 slots):')
            expect(html).toContain('misty step')
        })

        it('renders spellcasting in Actions section', async () => {
            const { renderStatBlock } = await import('../../js/components/modals/statBlock.js')
            
            const monster = {
                name: 'Caster',
                size: ['M'],
                type: 'humanoid',
                alignment: ['N'],
                ac: [{ ac: 12 }],
                hp: { average: 30 },
                speed: { walk: 30 },
                str: 10, dex: 12, con: 12, int: 16, wis: 12, cha: 10,
                cr: '3',
                spellcasting: [{
                    name: 'Spellcasting',
                    type: 'spellcasting',
                    headerEntries: ['The caster can cast spells.'],
                    will: ['{@spell fire bolt}']
                }],
                action: [{
                    name: 'Dagger',
                    entries: ['Melee attack: +4 to hit, 1d4+2 damage.']
                }]
            }
            
            const html = renderStatBlock(monster)
            
            // Actions section should contain both spellcasting and regular actions
            expect(html).toContain('Actions')
            expect(html).toContain('Spellcasting')
            expect(html).toContain('Dagger')
        })
    })
})
