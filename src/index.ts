/**
  @module
 */

export type ProceduralFunction<T = void> = () => T | Promise<T>
export type DeclarativeFunction<S> = (time: number) => S | undefined

export class Tracker<S = unknown> {
  protected t = 0
  protected log: [number, S][] = []
  protected runs: [number, number, DeclarativeFunction<void>][] = []

  useState = (v: S): [S, (next: S) => void] => {
    this.log.push([this.t, v])
    return [v, next => this.log.push([this.t, next])]
  }

  sleep = async (dt: number): Promise<void> => {
    this.t += dt
  }

  compile = async (f: ProceduralFunction<void>): Promise<DeclarativeFunction<S>> => {
    this.t = 0
    this.log = []
    this.runs = []
    await f()
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

  run = async (f: DeclarativeFunction<void>, duration: number): Promise<void> => {
    this.runs.push([this.t, duration, f])
  }
}
