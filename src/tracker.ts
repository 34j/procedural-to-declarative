/**
  @module
  Compile procedural state transitions (do, wait, set, wait, ...) into declarative time-to-state functions (t -> do, set).
 */

/**
 * Wait object.
 *
 * If yielded by a procedural function,
 * in that function
 * wait until one of the following conditions is met:
 * - one of the dependencies is done if dependencies is defined
 * - the duration has passed if duration is defined
 */
export interface Wait<TNumber extends number> {
  dependencies?: Set<ProceduralFunction<Wait<TNumber>>> | undefined
  duration?: TNumber | undefined
}

/**
 * Procedural function. useRef().current can be read and written.
 */
export type ProceduralFunction<TWait extends Wait<any>> = IterableIterator<TWait>

/**
 * Declarative function. useRef().current is write-only.
 */
export type DeclarativeFunction<TNumber extends number, T> = (time: TNumber) => T | undefined

/**
 * Reference object that can be read and written by `current` property.
 */
export interface Ref<T> { current: T }

/**
 * Task object that can be suspended and resumed. wait() returns a Wait object that specifies the conditions for the task to be finished.
 */
export interface Task<TWait extends Wait<any>>
{
  /**
   * Return a Wait object that specifies the conditions for the task to be finished.
   * @returns A Wait object that specifies the conditions for the task to be finished.
   */
  wait: () => TWait
  /**
   * Suspend the task.
   * @returns void
   */
  suspend: () => void
  /**
   * Resume the task.
   * @returns void
   */
  resume: () => void
}

/**
 * The state of a procedural function controlled by the track.
 */
export interface ProceduralState<TNumber extends number> {
  /**
   * The procedural function.
   */
  f: ProceduralFunction<Wait<TNumber>>
  /**
   * The number of `next()` calls made to the procedural function.
   */
  totalCallsCount: number
  /**
   * The wait object returned by the last `next()` call to the procedural function.
   */
  wait: Wait<TNumber>
  /**
   * Whether the procedural function is suspended.
   * If suspended, the procedural function will not be called and the wait time will not be updated.
   * When resumed, the procedural function will continue from where it was suspended.
   */
  suspended: boolean
}

export interface DeclarativeState<TNumber extends number> {
  /**
   * The declarative function.
   */
  f: DeclarativeFunction<TNumber, void>
  /**
   * The total time that the declarative function has been running.
   */
  progress: TNumber
  /**
   * The total duration of the declarative function.
   * Can be Infinity for infinite duration.
   */
  duration: TNumber
  /**
   * Whether the declarative function is suspended.
   * If suspended, the progress of the declarative function will not be updated and the function will not be called.
   * When resumed, the progress will continue from where it was suspended.
   */
  suspended: boolean
}

/**
 * The data structure that tracks the procedural and declarative states of a system.
 * Used to compile procedural state transitions into declarative time-to-state functions.
 */
export interface Track<TNumber extends number> {
  /**
   * The current time of the track used when compiling.
   */
  time: TNumber
  /**
   * The refs used in the procedural and declarative functions.
   * May be added to by useRef() calls.
   */
  refs: Ref<any>[]
  /**
   * The procedural states of the track.
   */
  proceduralStates: ProceduralState<TNumber>[]
  /**
   * The declarative states of the track.
   */
  declarativeStates: DeclarativeState<TNumber>[]
}

/**
 * The materialized state of the track at a specific time.
 */
export interface TrackMaterialized<TNumber extends number> {
  /**
   * The time of the fixed track.
   */
  time: TNumber
  /**
   * The values of the refs at the time of the fixed track.
   */
  refValues: Map<Ref<any>, any>
  /**
   * The deepcopied procedural states of the track at the time of the fixed track.
   */
  proceduralStates: ProceduralState<TNumber>[]
  /**
   * The deepcopied declarative states of the track at the time of the fixed track.
   */
  declarativeStates: DeclarativeState<TNumber>[]
}

/**
 * Create a ref and add it to the track.
 * @param track The track to add the ref to.
 * @param v The initial value of the ref.
 * @returns The created ref.
 */
export function useRef<T>(track: Track<any>, v: T): Ref<T> {
  const ref = { current: v }
  track.refs.push(ref)
  return ref
}

/**
 * Create an empty track.
 * @returns An empty track.
 */
export function createTrack<TNumber extends number>(): Track<TNumber> {
  return {
    time: 0 as TNumber,
    refs: [],
    proceduralStates: [],
    declarativeStates: [],
  }
}

/**
 * Sleep for a specified duration.
 * Can be yielded by a procedural function to wait for the specified duration.
 * @param dt The duration to sleep for.
 * @returns A Wait object that specifies the duration to sleep for.
 */
export const sleep = <TNumber extends number>(dt: TNumber): Wait<TNumber> => ({ duration: dt })

/**
 * Compile the procedural states of the track into declarative time-to-state functions.
 * @param track The track to compile.
 * @param time The maximum time to compile up to. If procedural functions have side effects that are not captured by the track, it may be used instead of `useCompiled()` to get the state of the track at a specific time. If not Infinity, the declarative states will be run as well.
 * @returns An array of fixed tracks, which are the materialized states of the track at specific times when procedural states change. Each fixed track contains the time, the values of the refs, and the procedural and declarative states at that time.
 */
export function compile<TNumber extends number>(track: Track<TNumber>, time: TNumber = Infinity as TNumber): TrackMaterialized<TNumber>[] {
  const fixedTracks: TrackMaterialized<TNumber>[] = []
  track.time = 0 as TNumber
  // Call next() of the generator with least wait time
  while (track.proceduralStates.filter(s => !s.suspended).length > 0 && track.time <= time) {
    // Next state must be the one with duration defined
    const filteredStates = track.proceduralStates.filter(s => s.wait.duration !== undefined && !s.suspended)
    if (filteredStates.length === 0) {
      throw new Error('No procedural state with dependencies not specified and wait time specified found.')
    }

    // State with least wait time
    const nextState = filteredStates.reduce((least, s) => (s.wait.duration! < least.wait.duration! ? s : least))
    // if (nextState.wait.duration === Infinity) {
    //   throw new Error('No procedural state with fixed wait time found.')
    // }

    // Remove the state
    track.proceduralStates = track.proceduralStates.filter(s => s !== nextState)

    // Subtract the wait time of the state from all other states
    const nextWaitTime = nextState.wait.duration!
    track.proceduralStates.forEach((s) => {
      if (s.wait.duration !== undefined && !s.suspended) {
        s.wait.duration = (s.wait.duration - nextWaitTime) as TNumber
      }
    })
    track.declarativeStates.forEach((s) => {
      if (!s.suspended) {
        s.progress = (s.progress + nextWaitTime) as TNumber
      }
    })

    // Time must be updated before calling next()
    track.time = (track.time + nextWaitTime) as TNumber

    // If the generator is done, remove it
    const iteratorResult = nextState.f.next()
    if (iteratorResult.done) {
      track.proceduralStates.forEach((s) => {
        if (s.wait.dependencies !== undefined && s.wait.dependencies.has(nextState.f)) {
          s.wait.duration = 0 as TNumber
          delete s.wait.dependencies
        }
      })
    }
    // Otherwise, update the wait time of the generator to the new value returned by next()
    else {
      // track.proceduralStates.push({ ...nextState, wait: iteratorResult.value, totalCallsCount: nextState.totalCallsCount + 1 })
      nextState.wait = iteratorResult.value
      nextState.totalCallsCount += 1
      track.proceduralStates.push(nextState)
    }

    // Remove declarative states that have ended
    track.declarativeStates = track.declarativeStates.filter(s => s.progress < s.duration)

    // Save the fixed track (copy)
    fixedTracks.push({
      time: track.time,
      refValues: new Map(track.refs.map(r => [r, r.current])),
      proceduralStates: [...track.proceduralStates.map(s => ({ ...s }))],
      declarativeStates: [...track.declarativeStates.map(s => ({ ...s }))],
    })
  }

  // Run remaining declarative states at the end
  // for the case where time is not Infinity
  track.declarativeStates.filter(s => s.progress < s.duration).forEach(s => s.f(s.progress))
  return fixedTracks
}

/**
 * Evaluate the state of the track at a specific time using the fixed tracks generated by `compile()`.
 * @param track The track to evaluate. Required to update the refs.
 * @param fixedTracks The fixed tracks generated by `compile()`.
 * @param time The time to evaluate the track at. Must be non-negative.
 */
export function useCompiled<TNumber extends number>(track: Track<TNumber>, fixedTracks: TrackMaterialized<TNumber>[], time: number) {
  const fixedTrack = fixedTracks.findLast(t => t.time <= time)
  if (!fixedTrack) {
    throw new Error(`No fixed track found for the given time.${time < 0 ? ' (Time cannot be negative.)' : ''}`)
  }
  track.refs.forEach((ref) => {
    if (fixedTrack.refValues.has(ref)) {
      ref.current = fixedTrack.refValues.get(ref)
    }
  })
  fixedTrack.declarativeStates.filter(s => s.progress < s.duration).forEach(s => s.f((s.progress + time - fixedTrack.time) as TNumber))
}

/**
 * Run a declarative function as a task and add it to the track.
 * @param track The track to add the task to.
 * @param f The declarative function to run as a task. The function will be called with the progress time as the argument, and can update the refs of the track. The function will be called every time the progress time is updated until the progress time reaches the duration of the task.
 * @param duration The duration of the task. Can be Infinity for infinite duration.
 * @returns A Task object that can be suspended and resumed. wait() returns a Wait object that specifies the duration of the task. When the task is suspended, the progress time will not be updated and the function will not be called. When the task is resumed, the progress time will continue from where it was suspended.
 */
export function runDeclarative<TNumber extends number>(track: Track<TNumber>, f: DeclarativeFunction<TNumber, void>, duration: TNumber): Task<Wait<TNumber>> {
  const state = { f, progress: 0 as TNumber, duration, suspended: false }
  track.declarativeStates.push(state)
  return {
    suspend: () => {
      if (state.suspended) {
        throw new Error('Task is already suspended.')
      }
      state.suspended = true
    },
    resume: () => {
      if (!state.suspended) {
        throw new Error('Task is not suspended.')
      }
      state.suspended = false
    },
    wait: () => sleep(duration),
  }
}

/**
 * Run a procedural function as a task and add it to the track.
 * @param track The track to add the task to.
 * @param f The procedural function to run as a task. The function will be called immediately and can update the refs of the track. The function can yield Wait objects to specify the conditions for the function to be called again. When the function is suspended, it will not be called and the wait time will not be updated. When the function is resumed, it will continue from where it was suspended.
 * @returns A Task object that can be suspended and resumed. wait() returns a Wait object that specifies the conditions for the task to be finished. When the task is suspended, the procedural function will not be called and the wait time will not be updated. When the task is resumed, the procedural function will continue from where it was suspended.
 */
export function runProcedural<TNumber extends number>(track: Track<TNumber>, f: ProceduralFunction<Wait<TNumber>>): Task<Wait<TNumber>> {
  // Run immediately
  const state = { f, wait: { duration: 0 as TNumber }, totalCallsCount: 0, suspended: false }
  track.proceduralStates.push(state)
  return {
    suspend: () => {
      if (state.suspended) {
        throw new Error('Task is already suspended.')
      }
      state.suspended = true
    },
    resume: () => {
      if (!state.suspended) {
        throw new Error('Task is not suspended.')
      }
      state.suspended = false
    },
    wait: () => ({
      dependencies: new Set([f]),
    }),
  }
}

/**
 * Run multiple tasks in parallel and return a task that is finished when all of the tasks are finished.
 * @param track The track to add the task to. Required to run the task using `runProcedural()`.
 * @param tasks The tasks to run in parallel. The returned task will be finished when all of the tasks are finished.
 * @returns A Task object that can be suspended and resumed. wait() returns a Wait object that is finished when all of the tasks are finished. When the task is suspended, all of the tasks will not be suspended. When the task is resumed, all of the tasks will not be resumed.
 */
export function all<TNumber extends number>(track: Track<TNumber>, tasks: Task<Wait<TNumber>>[]): Task<Wait<TNumber>> {
  return runProcedural(
    track,
    (function* () {
      yield* tasks.map(t => t.wait())
    })(),
  )
}

/**
 * Run multiple tasks in parallel and return a task that is finished when any of the tasks is finished.
 * @param tasks The tasks to run in parallel. The returned task will be finished when any of the tasks is finished.
 * @returns A Task object that can be suspended and resumed. wait() returns a Wait object that is finished when any of the tasks is finished. When the task is suspended, all of the tasks will be suspended. When the task is resumed, all of the tasks will be resumed.
 */
export function any<TNumber extends number>(tasks: Task<Wait<TNumber>>[]): Task<Wait<TNumber>> {
  return {
    suspend: () => tasks.forEach(t => t.suspend()),
    resume: () => tasks.forEach(t => t.resume()),
    wait: () => {
      const waits = tasks.map(t => t.wait())
      const dependencies = new Set(...waits.filter(w => w.dependencies !== undefined).map(w => w.dependencies!))
      const duration = Math.min(...waits.filter(w => w.duration !== undefined).map(w => w.duration!)) as TNumber
      return {
        dependencies: dependencies.size > 0 ? dependencies : undefined,
        duration: duration !== Infinity ? duration : undefined,
      }
    },
  }
}
