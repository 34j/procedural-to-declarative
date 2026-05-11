
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

export class Tracker<TNumber extends number> {
  useRef = <T>(v: T): Ref<T> => { return { current: v } }
  sleep = (dt: TNumber): TNumber => dt

  compile = (f: ProceduralFunction<TNumber>): DeclarativeFunction<TNumber, void> => {
}
