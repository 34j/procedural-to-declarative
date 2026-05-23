import type { Track } from '../src/tracker'
import { describe, expect, it } from 'vitest'
import { all, any, compile, runDeclarative, runProcedural, sleep, useCompiled, useRef } from '../src/tracker'

function toVisibleFixedTracks<TNumber extends number>(fixedTracks: ReturnType<typeof compile<TNumber>>) {
  return fixedTracks.map(fixedTrack => ({
    ...fixedTrack,
    refValues: Array.from(fixedTrack.refValues.entries(), ([ref, value]) => ({
      key: {
        current: ref.current,
      },
      value,
    })),
  }))
}

describe('index', () => {
  describe('tracker', () => {
    it('should correctly handle all', () => {
      const track: Track<number> = {
        time: 0,
        refs: [],
        proceduralStates: [],
        declarativeStates: [],
      }
      const x = useRef(track, 0)
      function* f() {
        function* g() {
          yield sleep(1)
          x.current = 1
        }
        function* h() {
          yield sleep(2)
          x.current = 2
        }
        yield all(track, [runProcedural(track, g()), runProcedural(track, h())]).wait()
      }
      runProcedural(track, f())
      const fixedTracks = compile(track)
      const visibleFixedTracks = toVisibleFixedTracks(fixedTracks)
      expect(visibleFixedTracks).toMatchSnapshot()
      const compiled = (time: number) => useCompiled(track, fixedTracks, time)
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
      expect(x.current).toBe(2)
      compiled(5)
      expect(x.current).toBe(2)
    })
    it('should correctly handle any', () => {
      const track: Track<number> = {
        time: 0,
        refs: [],
        proceduralStates: [],
        declarativeStates: [],
      }
      const x = useRef(track, 0)
      function* f() {
        function* g() {
          yield sleep(1)
          x.current = 1
        }
        function* h() {
          yield sleep(2)
          x.current = 2
        }
        yield any([runProcedural(track, g()), runProcedural(track, h())]).wait()
        x.current = 3
      }
      runProcedural(track, f())
      const fixedTracks = compile(track)
      const visibleFixedTracks = toVisibleFixedTracks(fixedTracks)
      expect(visibleFixedTracks).toMatchSnapshot()
      const compiled = (time: number) => useCompiled(track, fixedTracks, time)
      const eps = 1e-5
      compiled(0)
      expect(x.current).toBe(0)
      compiled(1 - eps)
      expect(x.current).toBe(0)
      compiled(1)
      expect(x.current).toBe(3)
      compiled(2 - eps)
      expect(x.current).toBe(3)
      compiled(2)
      expect(x.current).toBe(2)
      compiled(5)
      expect(x.current).toBe(2)
    })

    it('should support README example', () => {
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
        expect(track.time).toBe(2)
        yield runDeclarative(track, (time: number) => {
          x.current = 1 + time
        }, 1).wait()
        expect(track.time).toBe(3)
        yield sleep(1)
        expect(track.time).toBe(4)
        x.current += 1
        yield sleep(1)
        expect(track.time).toBe(5)
      }
      runProcedural(track, f())
      const fixedTracks = compile(track)
      const visibleFixedTracks = toVisibleFixedTracks(fixedTracks)
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
      expect(x.current).toBe(1)
      compiled(4)
      expect(x.current).toBe(2)
      compiled(5)
      expect(x.current).toBe(2)
      compiled(5 + eps)
      expect(x.current).toBe(2)
      expect(() => compiled(-1)).toThrow()
    })
  })
})
