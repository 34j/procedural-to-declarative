/**
  @module
 */

export type ProceduralFunction = () => Generator<void, void, void>
export type DeclarativeFunction<T> = (time: number) => T | undefined
export interface Ref<T> { current: T }
interface LogEntry<TNumber extends number, TValue> {
  t: TNumber
  v: TValue
}
interface RunEntry<TNumber extends number, TFn extends DeclarativeFunction<void>> {
  start: TNumber
  duration: TNumber
  fn: TFn
}

export class PureTracker<TNumber extends number> {
  protected t = 0
  protected log: LogEntry<TNumber, any>[] = []
  protected runs: RunEntry<TNumber, DeclarativeFunction<void>>[] = []

  reset = (): void => {
    this.t = 0
    this.log = []
    this.runs = []
  }

  useRef = (v: T): Ref<T> => {
    const ref = {} as Ref<T>
    Object.defineProperty(ref, 'current', {
      get: () => {
        throw new Error('PureTracker does not support reading from refs during procedural execution')
      },
      set: (next: T) => {
        this.log.push({ t: this.t, v: next})
      },
      enumerable: true,
    })
    this.log.push({ t: this.t, v })
    return ref
  }

  sleep = (dt: number): void => {
    this.t += dt
  }

  compile = (f: ProceduralFunction): DeclarativeFunction<T> => {
    const g = f()
    while (!g.next().done)
      continue
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
      return log.reduce<T | undefined>((s, [t, v]) => (t <= time ? v : s), undefined)
    }
  }

  run = (f: DeclarativeFunction<void>, duration: number): void => {
    this.runs.push([this.t, duration, f])
  }
}
