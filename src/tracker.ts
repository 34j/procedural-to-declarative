/**
 * Procedural
 */
export interface Wait<TNumber extends number, TType extends 'any' | 'all'> {
  dependencies: Set<ProceduralFunction<Wait<TNumber, TType>>>
  duration: TNumber | undefined
  type: TType
}
export type WaitConstant<TNumber extends number> = Wait<TNumber, 'any'>
export type WaitAny<TNumber extends number> = Wait<TNumber, 'any'>
export type WaitAll<TNumber extends number> = Wait<TNumber, 'all'>
/**
 * Procedural function. useRef().current can be read and written.
 */
export type ProceduralFunction<TWait extends Wait<any, any>> = IterableIterator<TWait>
/**
 * Declarative function. useRef().current is write-only.
 */
export type DeclarativeFunction<TNumber extends number, T> = (time: TNumber) => T | undefined
export interface Ref<T> { current: T }
export interface Task<TWait extends Wait<any, any>>
{
  wait: () => TWait
  cancel: () => void
}
export interface ProceduralState<TNumber extends number> {
  f: ProceduralFunction<Wait<TNumber, any>>
  wait: Wait<TNumber, any>
}
export interface DeclarativeState<TNumber extends number> {
  f: DeclarativeFunction<TNumber, void>
  startTime: TNumber
  duration: TNumber
}
export class Tracker<TNumber extends number> {
  useRef = <T>(v: T): Ref<T> => { return { current: v } }
  sleep = (dt: TNumber): WaitConstant<TNumber> => ({ dependencies: new Set<ProceduralFunction<Wait<TNumber, 'any'>>>(), duration: dt, type: 'any' })
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
      // Remove the least wait state
      this.proceduralStates = this.proceduralStates.filter(s => s !== leastWaitState)

      // Subtract the wait time
      const nextWaitTime = leastWaitState.wait.duration!
      const iteratorResult = leastWaitState.f.next()
      this.proceduralStates = this.proceduralStates.map((s) => {
        return { f: s.f, wait: s.wait.duration !== undefined ? { ...s.wait, duration: (s.wait.duration! - nextWaitTime) as TNumber } : s.wait }
      })

      // If the generator is done, remove it
      if (iteratorResult.done) {
        // any -> finish
      }
      // Otherwise, update the wait time of the generator to the new value returned by next()
      else {
        this.proceduralStates.push({ f: leastWaitState.f, wait: iteratorResult.value })
      }
    }
    this.declarativeStates.filter(s => time >= s.startTime && time < s.startTime + s.duration).forEach(s => s.f((time - s.startTime) as TNumber))
    this.currentTime = 0 as TNumber
  }

  runDeclarative = (f: DeclarativeFunction<TNumber, void>, duration: TNumber): Task<WaitConstant<TNumber>> => {
    this.declarativeStates.push({ f, startTime: this.currentTime, duration })
    return {
      cancel: () => {
        this.declarativeStates = this.declarativeStates.filter(s => s.f !== f)
      },
      wait: () => this.sleep(duration),
    }
  }

  runProcedural = (f: ProceduralFunction<Wait<TNumber, any>>): Task<WaitAny<TNumber>> => {
    this.proceduralStates.push({ f, wait: { dependencies: new Set(), duration: undefined, type: 'any' } })
    return {
      cancel: () => {
        this.proceduralStates = this.proceduralStates.filter(s => s.f !== f)
      },
      wait: () => ({
        dependencies: new Set([f]),
        type: 'any',
        duration: undefined,
      }),
    }
  }

  all = (tasks: Task<Wait<TNumber, any>>[]): Task<WaitAll<TNumber>> => {
    return {
      cancel: () => tasks.forEach(t => t.cancel()),
      wait: () => {
        const waits = tasks.map(t => t.wait())
        const dependencies = waits.reduce((s, w) => new Set([...s, ...w.dependencies]), new Set<ProceduralFunction<Wait<TNumber, any>>>())
        const duration = waits.reduce((max, w) => w.duration === undefined ? max : Math.max(max, w.duration) as TNumber, 0 as TNumber)
        return {
          dependencies,
          type: 'all',
          duration,
        }
      },
    }
  }

  any = (tasks: Task<Wait<TNumber, any>>[]): Task<WaitAny<TNumber>> => {
    return {
      cancel: () => tasks.forEach(t => t.cancel()),
      wait: () => {
        const waits = tasks.map(t => t.wait())
        const dependencies = waits.reduce((s, w) => new Set([...s, ...w.dependencies]), new Set<ProceduralFunction<Wait<TNumber, any>>>())
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
