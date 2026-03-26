/**
  @module
 */

export type ProceduralFunction = () => Generator<void, void, void>
export type DeclarativeFunction<TNumber extends number, T> = (time: TNumber) => T | undefined
export interface Ref<T> { current: T }

interface LogEntry<TNumber extends number, T> {
  t: TNumber
  v: T
}

interface RunEntry<TNumber extends number> {
  start: TNumber
  duration: TNumber
  fn: DeclarativeFunction<TNumber, void>
}

export class PureTracker<TNumber extends number> {
  protected t: TNumber = 0 as TNumber
  protected log: LogEntry<TNumber, any>[] = []
  protected runs: RunEntry<TNumber>[] = []
  protected isCompiling = false

  reset = (): void => {
    this.t = 0 as TNumber
    this.log = []
    this.runs = []
  }

  useRef = <T>(v: T): Ref<T> => {
    const ref = {} as Ref<T>
    Object.defineProperty(ref, 'current', {
      get: () => {
        throw new Error('Ref is write-only. Use Tracker instead')
      },
      set: (next: T) => {
        this.log.push({ t: this.t, v: next })
      },
      enumerable: true,
    })
    this.log.push({ t: this.t, v })
    return ref
  }

  sleep = (dt: TNumber): void => {
    this.t = (this.t + dt) as TNumber
  }

  compile = (f: ProceduralFunction): DeclarativeFunction<TNumber, void> => {
    this.reset()
    const g = f()
    while (!g.next().done)
      continue
    const maxT = Math.max(this.t, ...this.runs.map(e => e.start + e.duration))
    // Copy the log and runs so that they can be safely mutated during execution
    const baseLog = [...this.log]
    const baseRuns = [...this.runs]
    return (time) => {
      // Return undefined if time is out of bounds
      if (time < 0 || time > maxT)
        return undefined

      // Save the current t and log
      const prevT = this.t
      const prevLog = this.log

      // Set t to the current time and log to the base log
      this.t = time
      this.log = [...baseLog]
      this.isCompiling = true

      // Run functions
      // Because t is set to the current time, the function
      // may add new log entries at the current time.
      for (const e of [...baseRuns].reverse()) {
        const local = (time - e.start) as TNumber
        if (local >= 0 && local <= e.duration)
          e.fn(local)
      }
      const out = this.log.reduce<T | undefined>((s, e) => (e.t <= time ? e.v : s), undefined)
      this.t = prevT
      this.log = prevLog
      this.isCompiling = false
      return out
    }
  }

  run = (f: DeclarativeFunction<TNumber, void>, duration: TNumber): void => {
    if (!this.isCompiling) {
      throw new Error('run cannot be called within the function passed to run')
    }
    this.runs.push({ start: this.t, duration, fn: f })
    this.sleep(duration)
  }
}

export class Tracker<TNumber extends number> extends PureTracker<TNumber> {
}
