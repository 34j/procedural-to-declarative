import { describe, expect, it } from 'vitest'
import { PureTracker } from '../src/pureTracker'
import { Tracker } from '../src/tracker'

describe('index', () => {
  describe('the Tracker', () => {
    it('', () => {
      const tracker = new Tracker<number>()
      const x = tracker.useRef(0)
      function* f() {
        yield tracker.sleep(1)
        x.current = 1
        yield tracker.sleep(1)
        tracker.runDeclarative((time: number) => {
          x.current = 1 + time
        }, 1)
        yield tracker.sleep(1)
        x.current += 1
        yield tracker.sleep(1)
      }
      tracker.runProcedural(f())
      const compiled = tracker.declarativeCall
      const eps = 1e-5
      compiled(0)
      expect(x.current).toBe(0)
      compiled(1 - eps)
      expect(x.current).toBe(0)
      compiled(1)
      expect(x.current).toBe(1)
      compiled(2 - eps)
      expect(x.current).toBe(1)
      compiled(2)
      expect(x.current).toBe(1)
      compiled(2.5)
      expect(x.current).toBe(1.5)
      compiled(3)
      expect(x.current).toBe(2)
      compiled(4)
      expect(x.current).toBe(3)
      compiled(5)
      expect(x.current).toBe(3)
      compiled(-eps)
      expect(x.current).toBe(3)
      compiled(5 + eps)
      expect(x.current).toBe(3)
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
