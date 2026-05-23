/**
 * Procedural
 */
export interface Wait<TNumber extends number, TType extends 'any' | 'all'> {
  dependencies: Set<ProceduralFunction<Wait<TNumber, TType>>>
  duration: TNumber
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
      const filteredStates = this.proceduralStates.filter(s => (s.wait.type === 'any') || (s.wait.type === 'all' && s.wait.dependencies.size === 0))
      if (filteredStates.length === 0) {
        throw new Error('No procedural state any or all with no dependencies found.')
      }
      const nextState = filteredStates.reduce((least, s) => s.wait.duration < least.wait.duration ? s : least)
      if (nextState.wait.duration === Infinity) {
        throw new Error('No procedural state with fixed wait time found.')
      }
      // Remove the least wait state
      this.proceduralStates = this.proceduralStates.filter(s => s !== nextState)

      // Subtract the wait time
      const nextWaitTime = nextState.wait.duration!
      const iteratorResult = nextState.f.next()
      this.proceduralStates = this.proceduralStates.map((s) => {
        return { f: s.f, wait: { dependencies: s.wait.dependencies, duration: (s.wait.duration! - nextWaitTime) as TNumber, type: s.wait.type } }
      })

      // If the generator is done, remove it
      if (iteratorResult.done) {
        this.proceduralStates = this.proceduralStates.map(
          (s) => {
            if (!s.wait.dependencies.has(nextState.f)) {
              return s
            }
            // any -> remove all
            else if (s.wait.type === 'any') {
              return { f: s.f, wait: { dependencies: new Set([]), duration: 0 as TNumber, type: 'any' } }
            }
            // all -> remove only f
            else if (s.wait.type === 'all') {
              return { f: s.f, wait: { dependencies: new Set([...s.wait.dependencies].filter(d => d !== nextState.f)), duration: s.wait.duration, type: 'all' } }
            }
            return s
          },
        )
      }
      // Otherwise, update the wait time of the generator to the new value returned by next()
      else {
        this.proceduralStates.push({ f: nextState.f, wait: iteratorResult.value })
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
    // Run immediately
    this.proceduralStates.push({ f, wait: { dependencies: new Set(), duration: 0 as TNumber, type: 'any' } })
    return {
      cancel: () => {
        this.proceduralStates = this.proceduralStates.filter(s => s.f !== f)
      },
      wait: () => ({
        dependencies: new Set([f]),
        type: 'any',
        duration: Infinity as TNumber,
      }),
    }
  }
}

export function all<TNumber extends number>(tasks: Task<Wait<TNumber, any>>[]): Task<WaitAll<TNumber>> {
  return {
    cancel: () => tasks.forEach(t => t.cancel()),
    wait: () => {
      const waits = tasks.map(t => t.wait())
      const dependencies = waits.reduce((s, w) => new Set([...s, ...w.dependencies]), new Set<ProceduralFunction<Wait<TNumber, any>>>())
      const duration = Math.max(...waits.map(w => w.duration)) as TNumber
      return {
        dependencies,
        type: 'all',
        duration,
      }
    },
  }
}

export function any<TNumber extends number>(tasks: Task<Wait<TNumber, any>>[]): Task<WaitAny<TNumber>> {
  return {
    cancel: () => tasks.forEach(t => t.cancel()),
    wait: () => {
      const waits = tasks.map(t => t.wait())
      const dependencies = waits.reduce((s, w) => new Set([...s, ...w.dependencies]), new Set<ProceduralFunction<Wait<TNumber, any>>>())
      const duration = Math.min(...waits.map(w => w.duration)) as TNumber
      return {
        dependencies,
        type: 'any',
        duration,
      }
    },
  }
}
