import { describe, expect, it } from 'vitest'
import { Tracker } from '../src/tracker'
import { PureTracker } from '../src/pureTracker'

describe('index', () => {
  describe('the Tracker', () => {
    it('', () => {
      const tracker = new Tracker<number>()
      const fn = function* (): Generator<number, void, void> {
        const x = tracker.useRef(0)
        yield 1
        x.current = 1
        yield 1
        tracker.runDeclarative((time: number) => {
          x.current = 1 + time
        }, 1)
        yield 1
        x.current += 1
        yield 1
      }
      tracker.runProcedural(fn)
      const compiled = tracker.declarativeCall
      const eps = 1e-5
      // expect(compiled(0)).toBe(0)
      // expect(compiled(1 - eps)).toBe(0)
      // expect(compiled(1)).toBe(1)
      // expect(compiled(2 - eps)).toBe(1)
      // expect(compiled(2)).toBe(1)
      // expect(compiled(2.5)).toBe(1.5)
      // expect(compiled(3)).toBe(2)
      // expect(compiled(4)).toBe(3)
      // expect(compiled(5)).toBe(3)
      // expect(compiled(-eps)).toBeUndefined()
      // expect(compiled(5 + eps)).toBeUndefined()
    })
  })
  describe('the PureTracker', () => {
    it('', () => {
      const tracker = new PureTracker<number>()
      const fn = function (): void {
        const x = tracker.useRef(0)
        tracker.sleep(1)
        x.current = 1
        tracker.sleep(1)
        tracker.run((time: number) => {
          x.current = 1 + time
        }, 1)
        tracker.sleep(1)
        x.current = 3
        tracker.sleep(1)
      }
      const compiled = tracker.compile(fn)
      const eps = 1e-5
      expect(compiled(0)).toBe(0)
      expect(compiled(1 - eps)).toBe(0)
      expect(compiled(1)).toBe(1)
      expect(compiled(2 - eps)).toBe(1)
      expect(compiled(2)).toBe(1)
      expect(compiled(2.5)).toBe(1.5)
      expect(compiled(3)).toBe(2)
      expect(compiled(4)).toBe(3)
      expect(compiled(4.99)).toBe(3)
      expect(compiled(-eps)).toBeUndefined()
      expect(compiled(5 + eps)).toBeUndefined()
    })
  })
})
