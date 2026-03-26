/**
  @module
 */

export type ProceduralFunction = () => Generator<void, void, void>
export type DeclarativeFunction<S> = (time: number) => S | undefined
export interface Ref<S> { current: S }

export class Tracker<S = unknown> {
  protected t = 0
  protected log: [number, S][] = []
  protected runs: [number, number, DeclarativeFunction<void>][] = []

  useRef = (v: S): Ref<S> => {
    let cur = v
    const ref = {} as Ref<S>
    Object.defineProperty(ref, 'current', {
      get: () => cur,
      set: (next: S) => {
        cur = next
        this.log.push([this.t, next])
      },
      enumerable: true,
    })
    this.log.push([this.t, v])
    return ref
  }

  sleep = (dt: number): void => {
    this.t += dt
  }

  compile = (f: ProceduralFunction): DeclarativeFunction<S> => {
    this.t = 0
    this.log = []
    this.runs = []
    for (const _ of f()) _
    const maxT = Math.max(this.t, ...this.runs.map(([offset, duration]) => offset + duration))
    const baseLog = [...this.log]
    const baseRuns = [...this.runs]
    return (time) => {
      if (time < 0 || time > maxT)
        return undefined
      const prevT = this.t
      const prevLog = this.log
      const log = [...baseLog]
      this.log = log
      this.t = time
      for (const [offset, duration, fn] of [...baseRuns].reverse()) {
        const local = time - offset
        if (local >= 0 && local <= duration)
          fn(local)
      }
      this.t = prevT
      this.log = prevLog
      return log.reduce<S | undefined>((s, [t, v]) => (t <= time ? v : s), undefined)
    }
  }

  run = (f: DeclarativeFunction<void>, duration: number): void => {
    this.runs.push([this.t, duration, f])
  }
}
