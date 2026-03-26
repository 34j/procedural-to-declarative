import { describe, expect, it } from 'vitest'
import { Tracker } from '../src'

describe('index', () => {
  it('compiles procedural updates into a time->state function', () => {
    const tracker = new Tracker<number>()
    const fn = function* (): Generator<void, void, void> {
      const x = tracker.useRef(0)
      yield tracker.sleep(1)
      x.current = 1
      yield tracker.sleep(1)
      yield tracker.run((time) => {
        x.current = 1 + time
      }, 1)
      yield tracker.sleep(1)
      x.current += 1
      yield tracker.sleep(1)
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
    expect(compiled(5)).toBe(3)
    expect(compiled(-eps)).toBeUndefined()
    expect(compiled(5 + eps)).toBeUndefined()
  })
})
