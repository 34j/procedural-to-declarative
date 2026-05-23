import type { Track } from '../src/tracker'
import { describe, expect, it } from 'vitest'
import { compile, runDeclarative, runProcedural, sleep, useCompiled, useRef, any, all } from '../src/tracker'

describe('index', () => {
  describe('tracker', () => {
    describe('all', () => {
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
        yield all([runProcedural(track, g()), runProcedural(track, h())])
      }
      runProcedural(track, f())
      const fixedTracks = compile(track)
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
    describe('any', () => {
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
        yield any([runProcedural(track, g()), runProcedural(track, h())])
      }
      runProcedural(track, f())
      const fixedTracks = compile(track)
      const compiled = (time: number) => useCompiled(track, fixedTracks, time)
      const eps = 1e-5
      compiled(0)
      expect(x.current).toBe(0)
      compiled(1 - eps)
      expect(x.current).toBe(0)
      compiled(1)
      expect(x.current).toBe(1)
      compiled(5)
      expect(x.current).toBe(2)
    })

    it('sleeps', () => {
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
