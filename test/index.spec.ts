import type { Track } from '../src/tracker'
import { describe, expect, it } from 'vitest'
import { compile, runDeclarative, runProcedural, sleep, useCompiled, useRef } from '../src/tracker'

describe('index', () => {
  describe('the Tracker', () => {
    it('', () => {
      const track: Track<number> = {
        time: 0,
        refs: [],
        proceduralStates: [],
        declarativeStates: [],
      }
      const x = useRef(track, 0)
      function* f() {
        expect(track.time).toBe(0)
        yield sleep(1)
        expect(track.time).toBe(1)
        x.current = 1
        yield sleep(1)
        yield runDeclarative(track, (time: number) => {
          x.current = 1 + time
        }, 1).wait()
        yield sleep(1)
        x.current += 1
        yield sleep(1)
      }
      runProcedural(track, f())
      const fixedTracks = compile(track)
      const visibleFixedTracks = fixedTracks.map(fixedTrack => ({
        ...fixedTrack,
        refValues: Array.from(fixedTrack.refValues.entries(), ([ref, value]) => ({
          key: {
            current: ref.current,
          },
          value,
        })),
      }))
      expect(visibleFixedTracks).toMatchSnapshot()
      const eps = 1e-5
      const compiled = (time: number) => useCompiled(track, fixedTracks, time)
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
})
