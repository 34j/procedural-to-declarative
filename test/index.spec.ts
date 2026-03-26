import { describe, expect, it } from 'vitest'
import { Tracker } from '../src'

describe('index', () => {
  it('compiles procedural updates into a time->state function', async () => {
    const tracker = new Tracker<number>()
    const fn = async (): Promise<void> => {
      const [, setX] = tracker.useState(0)
      await tracker.sleep(1)
      setX(1)
      await tracker.sleep(1)
      await tracker.run(time => setX(1 + time), 1)
    }
    const compiled = await tracker.compile(fn)
    const eps = 1e-5
    expect(compiled(0)).toBe(0)
    expect(compiled(1 - eps)).toBe(0)
    expect(compiled(1)).toBe(1)
    expect(compiled(2 - eps)).toBe(1)
    expect(compiled(2)).toBe(1)
    expect(compiled(2.5)).toBe(1.5)
    expect(compiled(3)).toBe(2)
    expect(compiled(-eps)).toBeUndefined()
    expect(compiled(3 + eps)).toBeUndefined()
  })
})
