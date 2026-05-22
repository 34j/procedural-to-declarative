/**
 * Procedural
 */

/**
 * Procedural function. useRef().current can be read and written.
 */
export type ProceduralFunction<TNumber extends number> = () => Generator<TNumber, void, void>
/**
 * Declarative function. useRef().current is write-only.
 */
export type DeclarativeFunction<TNumber extends number, T> = (time: TNumber) => T | undefined
export interface Ref<T> { current: T }
export interface Task
{
  cancel: () => void
}
export interface ProceduralState<TNumber extends number> {
  gen: Generator<TNumber, void, void>
  waitTime: TNumber
}
export interface DeclarativeState<TNumber extends number> {
  fn: DeclarativeFunction<TNumber, void>
  startTime: TNumber
  duration: TNumber
}
export class Tracker<TNumber extends number> {
  useRef = <T>(v: T): Ref<T> => { return { current: v } }
  // sleep = (dt: TNumber): TNumber => dt
  proceduralStates: ProceduralState<TNumber>[] = []
  declarativeStates: DeclarativeState<TNumber>[] = []
  currentTime: TNumber = 0 as TNumber
  declarativeCall = (time: TNumber) => {
    // Call next() of the generator with least wait time
    while (this.proceduralStates.length > 0 && this.currentTime <= time) {
      const nextState = this.proceduralStates.reduce((prev, curr) => prev.waitTime < curr.waitTime ? prev : curr)
      this.proceduralStates = this.proceduralStates.filter(s => s !== nextState)
      const nextWaitTime = nextState.waitTime
      const iteratorResult = nextState.gen.next()
      this.proceduralStates = this.proceduralStates.map(s => s === nextState ? { ...s, waitTime: (s.waitTime - nextWaitTime) as TNumber } : s)

      // If the generator is done, simply remove it
      if (iteratorResult.done) {
        ;
      }
      // Otherwise, update the wait time of the generator to the new value returned by next()
      else {
        this.proceduralStates.push({ gen: nextState.gen, waitTime: iteratorResult.value })
      }
    }
    this.declarativeStates.filter(s => time >= s.startTime && time < s.startTime + s.duration).forEach(s => s.fn((time - s.startTime) as TNumber))
    this.currentTime = 0 as TNumber
  }

  runDeclarative = (f: DeclarativeFunction<TNumber, void>, duration: TNumber): void => {
    this.declarativeStates.push({ fn: f, startTime: this.currentTime, duration })
  }

  runProcedural = (f: ProceduralFunction<TNumber>): void => {
    this.proceduralStates.push({ gen: f(), waitTime: 0 as TNumber })
  }
}
