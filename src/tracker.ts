/**
 * Procedural
 */
export interface Wait<TNumber extends number> {
  dependencies: Set<ProceduralFunction<Wait<TNumber>>> | undefined
  duration: TNumber | undefined
}
/**
 * Procedural function. useRef().current can be read and written.
 */
export type ProceduralFunction<TWait extends Wait<any>> = IterableIterator<TWait>
/**
 * Declarative function. useRef().current is write-only.
 */
export type DeclarativeFunction<TNumber extends number, T> = (time: TNumber) => T | undefined
export interface Ref<T> { current: T }
export interface Task<TWait extends Wait<any>>
{
  wait: () => TWait
  cancel: () => void
}
export interface ProceduralState<TNumber extends number> {
  f: ProceduralFunction<Wait<TNumber>>
  totalCallsCount: number
  wait: Wait<TNumber>
}
export interface DeclarativeState<TNumber extends number> {
  f: DeclarativeFunction<TNumber, void>
  startTime: TNumber
  duration: TNumber
}

export interface Track<TNumber extends number> {
  time: TNumber
  refs: Ref<any>[]
  proceduralStates: ProceduralState<TNumber>[]
  declarativeStates: DeclarativeState<TNumber>[]
}

export interface FixedTrack<TNumber extends number> {
  time: TNumber
  refValues: Map<Ref<any>, any>
  proceduralStates: ProceduralState<TNumber>[]
  declarativeStates: DeclarativeState<TNumber>[]
}

export function useRef<T>(track: Track<any>, v: T): Ref<T> {
  const ref = { current: v }
  track.refs.push(ref)
  return ref
}

export const sleep = <TNumber extends number>(dt: TNumber): Wait<TNumber> => ({ dependencies: new Set<ProceduralFunction<Wait<TNumber>>>(), duration: dt })

export function compile<TNumber extends number>(track: Track<TNumber>, time: TNumber = Infinity as TNumber): FixedTrack<TNumber>[] {
  const fixedTracks: FixedTrack<TNumber>[] = []
  track.time = 0 as TNumber
  // Call next() of the generator with least wait time
  while (track.proceduralStates.length > 0 && track.time <= time) {
    const filteredStates = track.proceduralStates.filter(s => s.wait.duration !== undefined && s.wait.dependencies === undefined)
    if (filteredStates.length === 0) {
      throw new Error('No procedural state with dependencies not specified and wait time specified found.')
    }

    // State with least wait time
    const nextState = filteredStates.reduce((least, s) => (s.wait.duration! < least.wait.duration! ? s : least))
    if (nextState.wait.duration === Infinity) {
      throw new Error('No procedural state with fixed wait time found.')
    }

    // Remove the state
    track.proceduralStates = track.proceduralStates.filter(s => s !== nextState)

    // Subtract the wait time of the state from all other states
    const nextWaitTime = nextState.wait.duration!
    track.proceduralStates = track.proceduralStates.map((s) => {
      return { ...s, wait: { ...s.wait, duration: (s.wait.duration! - nextWaitTime) as TNumber } }
    })

    // Time must be updated before calling next()
    track.time = (track.time + nextWaitTime) as TNumber

    // If the generator is done, remove it
    const iteratorResult = nextState.f.next()
    if (iteratorResult.done) {
      track.proceduralStates = track.proceduralStates.map(
        (s) => {
          if (s.wait.dependencies === undefined || !s.wait.dependencies.has(nextState.f)) {
            return s
          }
          else {
            return { ...s, wait: { ...s.wait, dependencies: undefined, duration: 0 as TNumber } }
          }
        },
      )
    }
    // Otherwise, update the wait time of the generator to the new value returned by next()
    else {
      track.proceduralStates.push({ ...nextState, wait: iteratorResult.value, totalCallsCount: nextState.totalCallsCount + 1 })
    }
    track.declarativeStates = track.declarativeStates.filter(s => (track.time < s.startTime + s.duration))
    fixedTracks.push({
      time: track.time,
      refValues: new Map(track.refs.map(r => [r, r.current])),
      proceduralStates: [...track.proceduralStates],
      declarativeStates: [...track.declarativeStates],
    })
  }
  track.declarativeStates.filter(s => time >= s.startTime && time < s.startTime + s.duration).forEach(s => s.f((time - s.startTime) as TNumber))
  return fixedTracks
}

export function useCompiled<TNumber extends number>(track: Track<TNumber>, fixedTracks: FixedTrack<TNumber>[], time: number) {
  if (time < 0) {
    throw new Error('Time cannot be negative.')
  }
  const fixedTrack = fixedTracks.findLast(t => t.time <= time)
  if (!fixedTrack) {
    throw new Error('No fixed track found for the given time.')
  }
  track.refs.forEach((ref) => {
    if (fixedTrack.refValues.has(ref)) {
      ref.current = fixedTrack.refValues.get(ref)
    }
  })
  fixedTrack.declarativeStates.filter(s => (time >= s.startTime) && (time < s.startTime + s.duration)).forEach(s => s.f((time - s.startTime) as TNumber))
}

export function runDeclarative<TNumber extends number>(track: Track<TNumber>, f: DeclarativeFunction<TNumber, void>, duration: TNumber): Task<Wait<TNumber>> {
  track.declarativeStates.push({ f, startTime: track.time, duration })
  return {
    cancel: () => {
      track.declarativeStates = track.declarativeStates.filter(s => s.f !== f)
    },
    wait: () => sleep(duration),
  }
}

export function runProcedural<TNumber extends number>(track: Track<TNumber>, f: ProceduralFunction<Wait<TNumber>>): Task<Wait<TNumber>> {
  // Run immediately
  track.proceduralStates.push({ f, wait: { dependencies: undefined, duration: undefined }, totalCallsCount: 0 })
  return {
    cancel: () => {
      track.proceduralStates = track.proceduralStates.filter(s => s.f !== f)
    },
    wait: () => ({
      dependencies: new Set([f]),
      duration: undefined,
    }),
  }
}

export function all<TNumber extends number>(track: Track<TNumber>, tasks: Task<Wait<TNumber>>[]): Task<Wait<TNumber>> {
  return runProcedural(
    track,
    (function* () {
      yield* tasks.map(t => t.wait())
    })(),
  )
}

export function any<TNumber extends number>(tasks: Task<Wait<TNumber>>[]): Task<Wait<TNumber>> {
  return {
    cancel: () => tasks.forEach(t => t.cancel()),
    wait: () => {
      const waits = tasks.map(t => t.wait())
      const dependencies = waits.reduce((s, w) => new Set([...s, ...w.dependencies]), new Set<ProceduralFunction<Wait<TNumber>>>())
      const duration = waits.map(w => w.duration).reduce((d1, d2) => Math.min(d1 ?? (Infinity as TNumber), d2 ?? (Infinity as TNumber)), Infinity as TNumber)
      return {
        dependencies,
        duration: duration === Infinity ? undefined : duration,
      }
    },
  }
}
