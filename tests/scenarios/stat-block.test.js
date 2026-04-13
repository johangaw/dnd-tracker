// Tests for Stat Block rendering and helper utilities
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initApp, click, tick, exists, getText } from '../helpers.js'
import { formatEntries, formatName } from '../../js/utils/helpers.js'
import { renderStatBlock } from '../../js/components/modals/statBlock.js'

describe('Stat Block', () => {
    beforeEach(async () => {
        await initApp()
    })

    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    describe('formatEntries', () => {
        it('strips source suffix from condition tags', () => {
            const entries = ['{@condition Grappled|XPHB}']
            const result = formatEntries(entries)
            expect(result).toBe('Grappled')
            expect(result).not.toContain('|')
            expect(result).not.toContain('XPHB')
        })

        it('strips source suffix from skill tags', () => {
            const entries = ['{@skill Perception|XPHB}']
            const result = formatEntries(entries)
            expect(result).toBe('Perception')
        })

        it('strips source suffix from creature tags', () => {
            const entries = ['{@creature Goblin|MM}']
            const result = formatEntries(entries)
            expect(result).toBe('Goblin')
        })

        it('strips source suffix from item tags', () => {
            const entries = ['{@item Longsword|PHB}']
            const result = formatEntries(entries)
            expect(result).toBe('Longsword')
        })

        it('strips source suffix from damage tags', () => {
            const entries = ['{@damage 2d6|XPHB}']
            const result = formatEntries(entries)
            expect(result).toBe('2d6')
        })

        it('strips source suffix from dice tags', () => {
            const entries = ['{@dice 1d20|PHB}']
            const result = formatEntries(entries)
            expect(result).toBe('1d20')
        })

        it('strips source suffix from sense tags', () => {
            const entries = ['{@sense darkvision|XPHB}']
            const result = formatEntries(entries)
            expect(result).toBe('darkvision')
        })

        it('strips source suffix from status tags', () => {
            const entries = ['{@status prone|XPHB}']
            const result = formatEntries(entries)
            expect(result).toBe('prone')
        })

        it('strips source suffix from action tags', () => {
            const entries = ['{@action Dodge|XPHB}']
            const result = formatEntries(entries)
            expect(result).toBe('Dodge')
        })

        it('handles tags without source suffix', () => {
            const entries = ['{@condition Frightened}']
            const result = formatEntries(entries)
            expect(result).toBe('Frightened')
        })

        it('formats hit tags correctly', () => {
            const entries = ['{@hit 5}']
            const result = formatEntries(entries)
            expect(result).toBe('+5')
        })

        it('formats DC tags correctly', () => {
            const entries = ['{@dc 15}']
            const result = formatEntries(entries)
            expect(result).toBe('DC 15')
        })

        it('formats recharge tags correctly', () => {
            const entries = ['{@recharge}']
            const result = formatEntries(entries)
            expect(result).toBe('(Recharge 6)')
        })

        it('formats recharge with number correctly', () => {
            const entries = ['{@recharge 5}']
            const result = formatEntries(entries)
            expect(result).toBe('(Recharge 5-6)')
        })

        it('creates spell links for spell tags', () => {
            const entries = ['{@spell Fireball|PHB}']
            const result = formatEntries(entries)
            expect(result).toContain('href="https://www.aidedd.org/spell/fireball"')
            expect(result).toContain('Fireball')
        })

        it('handles complex entry with multiple tags', () => {
            const entries = ['The target must make a {@dc 15} Wisdom saving throw or be {@condition Frightened|XPHB} for 1 minute.']
            const result = formatEntries(entries)
            expect(result).toContain('DC 15')
            expect(result).toContain('Frightened')
            expect(result).not.toContain('|XPHB')
        })
    })

    describe('formatName', () => {
        it('formats recharge in action names', () => {
            const result = formatName('Fire Breath {@recharge 5}')
            expect(result).toBe('Fire Breath (Recharge 5-6)')
        })

        it('formats recharge 6 in action names', () => {
            const result = formatName('Lightning Breath {@recharge}')
            expect(result).toBe('Lightning Breath (Recharge 6)')
        })
    })

    describe('renderStatBlock', () => {
        it('generates token URL for monster with source', () => {
            const monster = {
                name: 'Goblin',
                source: 'MM',
                size: ['S'],
                type: 'humanoid',
                alignment: ['N', 'E'],
                ac: [{ ac: 15 }],
                hp: { average: 7, formula: '2d6' },
                speed: { walk: 30 },
                str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8,
                cr: '1/4',
                passive: 9
            }
            const html = renderStatBlock(monster)
            expect(html).toContain('monster-token')
            expect(html).toContain('https://5e.tools/img/bestiary/tokens/MM/Goblin.webp')
        })

        it('uses MM as default source for custom monsters', () => {
            const monster = {
                name: 'Custom Beast',
                size: ['M'],
                type: 'beast',
                alignment: ['U'],
                ac: [{ ac: 12 }],
                hp: { average: 10 },
                speed: { walk: 40 },
                str: 14, dex: 12, con: 12, int: 2, wis: 10, cha: 6,
                cr: '1/2',
                passive: 10
            }
            const html = renderStatBlock(monster)
            expect(html).toContain('https://5e.tools/img/bestiary/tokens/MM/Custom%20Beast.webp')
        })

        it('URL encodes monster names with special characters', () => {
            const monster = {
                name: "Hobgoblin Captain",
                source: 'MM',
                size: ['M'],
                type: 'humanoid',
                alignment: ['L', 'E'],
                ac: [{ ac: 17 }],
                hp: { average: 39 },
                speed: { walk: 30 },
                str: 15, dex: 14, con: 14, int: 12, wis: 10, cha: 13,
                cr: '3',
                passive: 10
            }
            const html = renderStatBlock(monster)
            expect(html).toContain('Hobgoblin%20Captain.webp')
        })

        it('strips source suffix from condition immunities', () => {
            const monster = {
                name: 'Test Monster',
                source: 'MM',
                size: ['M'],
                type: 'undead',
                alignment: ['N', 'E'],
                ac: [{ ac: 12 }],
                hp: { average: 22 },
                speed: { walk: 30 },
                str: 10, dex: 14, con: 10, int: 6, wis: 10, cha: 8,
                cr: '1',
                passive: 10,
                conditionImmune: ['Exhaustion|XPHB', 'Poisoned|XPHB']
            }
            const html = renderStatBlock(monster)
            expect(html).toContain('Exhaustion')
            expect(html).toContain('Poisoned')
            expect(html).not.toContain('|XPHB')
        })

        it('includes onerror handler for token image fallback', () => {
            const monster = {
                name: 'Test',
                source: 'MM',
                size: ['M'],
                type: 'humanoid',
                alignment: ['N'],
                ac: [{ ac: 10 }],
                hp: { average: 4 },
                speed: { walk: 30 },
                str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
                cr: '0',
                passive: 10
            }
            const html = renderStatBlock(monster)
            expect(html).toContain('onerror="this.style.display=\'none\'"')
        })
    })
})
