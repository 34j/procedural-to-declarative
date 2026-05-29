import { describe, expect, it } from 'vitest'
import { all } from '../src/all.ts'
import { any, compile, createTrack, runDeclarative, runProcedural, sleep, toVisibleFrames, useCompiled, useRef } from '../src/index.ts'

const eps = 1e-5
describe('index', () => {
  describe('tracker', () => {
    it('should suspend and resume declarative', () => {
      const track = createTrack()
      const x = useRef(track, 0)
      function* f() {
        const task = runDeclarative(track, (time: number) => {
          x.current = time
        }, 10)
        yield sleep(1)
        task.isSuspended = true
        yield sleep(1)
        task.isSuspended = false
      }
      runProcedural(track, f())
      const frames = compile(track)
      const visibleFrames = toVisibleFrames(frames)
      expect(visibleFrames).toMatchSnapshot()
      const compiled = (time: number) => useCompiled(track, frames, time)
      compiled(0)
      expect(x.current).toBe(0)
      compiled(1)
      expect(x.current).toBe(1)
      compiled(2)
      expect(x.current).toBe(1)
      compiled(3)
      expect(x.current).toBe(2)
    })
    it('should cancel and resume procedural', () => {
      const track = createTrack()
      const x = useRef(track, 0)
      function* f() {
        const taskG = runProcedural(track, g())
        yield sleep(2)
        taskG.isSuspended = true
        yield sleep(2)
        taskG.isSuspended = false
      }
      function* g() {
        yield sleep(1)
        x.current = 1
        yield sleep(2)
        x.current = 2
      }
      runProcedural(track, f())
      const frames = compile(track)
      const visibleFrames = toVisibleFrames(frames)
      expect(visibleFrames).toMatchSnapshot()
      const compiled = (time: number) => useCompiled(track, frames, time)

      compiled(0)
      expect(x.current).toBe(0)
      compiled(1 - eps)
      expect(x.current).toBe(0)
      compiled(1)
      expect(x.current).toBe(1)
      compiled(5 - eps)
      expect(x.current).toBe(1)
      compiled(5)
      expect(x.current).toBe(2)
    })
    it('should raise when dead lock', () => {
      const track = createTrack()
      let taskF: ReturnType<typeof runProcedural>
      let taskG: ReturnType<typeof runProcedural>
      function* f() {
        yield taskG
      }
      function* g() {
        yield taskF
      }
      taskF = runProcedural(track, f())
      taskG = runProcedural(track, g())
      expect(() => compile(track)).toThrow()
    })
    it('should correctly handle all with same time', () => {
      const track = createTrack()
      function* f() {
        function* g() {
          yield sleep(1)
        }
        function* h() {
          yield sleep(0.4)
        }
        yield all(track, [runProcedural(track, g()), runProcedural(track, h())])
      }
      runProcedural(track, f())
      const frames = compile(track)
      const visibleFrames = toVisibleFrames(frames)
      expect(visibleFrames).toMatchSnapshot()
    })
    it('should correctly handle all', () => {
      const track = createTrack()
      const x = useRef(track, 0)
      function* f() {
        function* g() {
          yield sleep(1)
          x.current += 1
        }
        function* h() {
          yield sleep(2)
          x.current *= 2
        }
        yield all(track, [runProcedural(track, g()), runProcedural(track, h())])
      }
      runProcedural(track, f())
      const frames = compile(track)
      const visibleFrames = toVisibleFrames(frames)
      expect(visibleFrames).toMatchSnapshot()
      const compiled = (time: number) => useCompiled(track, frames, time)

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
      const track = createTrack()
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
        x.current = 3
      }
      runProcedural(track, f())
      const frames = compile(track)
      const visibleFrames = toVisibleFrames(frames)
      expect(visibleFrames).toMatchSnapshot()
      const compiled = (time: number) => useCompiled(track, frames, time)

      compiled(0)
      expect(x.current).toBe(0)
      compiled(1 - eps)
      expect(x.current).toBe(0)
      compiled(1)
      expect(x.current).toBe(3)
      compiled(2 - eps)
      expect(x.current).toBe(3)
      compiled(2)
      expect(x.current).toBe(3)
      compiled(5)
      expect(x.current).toBe(3)
    })

    it('should support README example', () => {
      const track = createTrack()
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
        }, 1)
        expect(track.time).toBe(3)
        yield sleep(1)
        expect(track.time).toBe(4)
        x.current += 1
        yield sleep(1)
        expect(track.time).toBe(5)
      }
      runProcedural(track, f())
      const frames = compile(track)
      const visibleFrames = toVisibleFrames(frames)
      expect(visibleFrames).toMatchSnapshot()

      const compiled = (time: number) => useCompiled(track, frames, time)
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
