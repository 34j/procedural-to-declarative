/**
  @module
 */

export class Tracker<S = unknown> {
  private t = 0
  private log: [number, S][] = []

  useState = <T extends S>(v: T): [T, (next: T) => void] => {
    this.log.push([this.t, v])
    return [v, next => this.log.push([this.t, next])]
  }

  sleep = async (dt: number): Promise<void> => {
    this.t += dt
  }

  compile = async (f: () => void | Promise<void>): Promise<(time: number) => S | undefined> => {
    this.t = 0
    this.log = []
    await f()
    return time => this.log.reduce<S | undefined>((s, [t, v]) => (t <= time ? v : s), undefined)
  }
}
