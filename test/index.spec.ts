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
      setX(2)
      await tracker.sleep(1)
    }
    const compiled = await tracker.compile(fn)
    expect(compiled(0.5)).toBe(0)
    expect(compiled(2.5)).toBe(2)
    expect(compiled(-1)).toBeUndefined()
    expect(compiled(9)).toBe(2)
  })
})
