/**
 * Procedural
 */
export interface Wait<TNumber extends number, TDuration extends TNumber | undefined, TType extends 'any' | 'all'> {
  dependencies: Set<ProceduralFunction<TNumber>>
  duration: TDuration
  type: TType
}
export type ConstantWait<TNumber extends number> = Wait<TNumber, TNumber, 'any'>
export type WaitAny<TNumber extends number, TDuration extends TNumber | undefined> = Wait<TNumber, TDuration, 'any'>
export type WaitAll<TNumber extends number, TDuration extends TNumber | undefined> = Wait<TNumber, TDuration, 'all'>
/**
 * Procedural function. useRef().current can be read and written.
 */
export type ProceduralFunction<TNumber extends number> = () => Iterator<TNumber, void, void>
/**
 * Declarative function. useRef().current is write-only.
 */
export type DeclarativeFunction<TNumber extends number, T> = (time: TNumber) => T | undefined
export interface Ref<T> { current: T }
export interface Task<TWait extends Wait<any, any, any>>
{
  wait: () => TWait
  cancel: () => void
}
export interface ProceduralState<TNumber extends number> {
  gen: Generator<TNumber, void, void>
  wait: Wait<TNumber, any, any>
}
export interface DeclarativeState<TNumber extends number> {
  fn: DeclarativeFunction<TNumber, void>
  startTime: TNumber
  duration: TNumber
}
export class Tracker<TNumber extends number> {
  useRef = <T>(v: T): Ref<T> => { return { current: v } }
  sleep = (dt: TNumber): ConstantWait<TNumber> => ({ dependencies: new Set(), duration: dt, type: 'any' })
  proceduralStates: ProceduralState<TNumber>[] = []
  declarativeStates: DeclarativeState<TNumber>[] = []
  currentTime: TNumber = 0 as TNumber
  declarativeCall = (time: TNumber) => {
    // Call next() of the generator with least wait time
    while (this.proceduralStates.length > 0 && this.currentTime <= time) {
      const leastWaitState = this.proceduralStates.filter(s => s.wait.duration !== undefined).reduce((least, s) => s.wait.duration! < least.wait.duration! ? s : least)
      if (leastWaitState.wait.duration === undefined) {
        throw new Error('No procedural state with fixed wait time found.')
      }
      this.proceduralStates = this.proceduralStates.filter(s => s !== leastWaitState)
      const nextWaitTime = leastWaitState.wait.duration!
      const iteratorResult = leastWaitState.gen.next()
      this.proceduralStates = this.proceduralStates.map(s => s === leastWaitState ? { ...s, waitTime: (s.wait.duration - nextWaitTime) as TNumber } : s)

      // If the generator is done, simply remove it
      if (iteratorResult.done) {
        ;
      }
      // Otherwise, update the wait time of the generator to the new value returned by next()
      else {
        this.proceduralStates.push({ gen: leastWaitState.gen, wait: iteratorResult.value })
      }
    }
    this.declarativeStates.filter(s => time >= s.startTime && time < s.startTime + s.duration).forEach(s => s.fn((time - s.startTime) as TNumber))
    this.currentTime = 0 as TNumber
  }

  runDeclarative = (f: DeclarativeFunction<TNumber, void>, duration: TNumber): Task<ConstantWait<TNumber>> => {
    this.declarativeStates.push({ fn: f, startTime: this.currentTime, duration })
    return {
      cancel: () => {
        this.declarativeStates = this.declarativeStates.filter(s => s.fn !== f)
      },
      wait: () => this.sleep(duration),
    }
  }

  runProcedural = (f: ProceduralFunction<TNumber>): Task<WaitAny<TNumber, undefined>> => {
    this.proceduralStates.push({ gen: f(), waitTime: 0 as TNumber })
    return {
      cancel: () => {
        this.proceduralStates = this.proceduralStates.filter(s => s.gen !== f)
      },
      wait: () => ({
        dependencies: new Set(f),
        type: 'any',
        duration: undefined,
      }),
    }
  }

  all = (tasks: Task<Wait<TNumber, any, any>>[]): Task<WaitAll<TNumber, any>> => {
    return {
      cancel: () => tasks.forEach(t => t.cancel()),
      wait: () => {
        const waits = tasks.map(t => t.wait())
        const dependencies = waits.reduce((s, w) => new Set([...s, ...w.dependencies]), new Set<ProceduralFunction<TNumber>>())
        const duration = waits.reduce((max, w) => w.duration === undefined ? max : Math.max(max, w.duration) as TNumber, 0 as TNumber)
        return {
          dependencies,
          type: 'all',
          duration,
        }
      },
    }
  }

  any = (tasks: Task<Wait<TNumber, any, any>>[]): Task<WaitAny<TNumber, any>> => {
    return {
      cancel: () => tasks.forEach(t => t.cancel()),
      wait: () => {
        const waits = tasks.map(t => t.wait())
        const dependencies = waits.reduce((s, w) => new Set([...s, ...w.dependencies]), new Set<ProceduralFunction<TNumber>>())
        const duration = waits.reduce((min, w) => w.duration === undefined ? min : Math.min(min, w.duration) as TNumber, Infinity as TNumber)
        return {
          dependencies,
          type: 'any',
          duration: duration === Infinity ? undefined : duration,
        }
      },
    }
  }
}
