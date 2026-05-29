/**
  @module
  Compile procedural state transitions (do, wait, set, wait, ...) into declarative time-to-state functions (t -> do, set).
 */

/**
 * Reference object that can be read and written through `current`.
 */
export interface Ref<T> { current: T }

/**
 * Task object.
 *
 * Waited if yielded by a procedural function.
 */
export interface TaskBase {
  isSuspended: boolean
}

/**
 * A task that completes after a fixed duration.
 */
export interface TaskConstant<TNumber extends number = number> extends TaskBase {
  type: 'constant'
  duration: TNumber
}

export type ProceduralFunction<TNumber extends number> = IterableIterator<Task<TNumber>>

/**
 * A procedural task that advances by yielding waits.
 */
export interface TaskFunc<TNumber extends number = number> extends TaskBase {
  type: 'func'
  f: ProceduralFunction<TNumber>
}

/**
 * A composite task that finishes when any child finishes.
 */
export interface TaskAny<TNumber extends number = number> extends TaskBase {
  type: 'any'
  tasks: Task<TNumber>[]
}

/**
 * A declarative task evaluated from elapsed time.
 */
export interface TaskDeclarative<TNumber extends number = number> extends TaskBase {
  type: 'declarative'
  f: (time: TNumber) => void
  duration: TNumber
}

export type Task<TNumber extends number = number>
  = | TaskConstant<TNumber>
    | TaskFunc<TNumber>
    | TaskAny<TNumber>
    | TaskDeclarative<TNumber>

export interface ProcessState<TNumber extends number = number> {
  type: 'constant' | 'func' | 'any' | 'declarative'
  done: boolean
  progress: TNumber
  waitTarget?: Task<TNumber> | undefined
  tasks?: Task<TNumber>[]
}

/**
 * The data structure that tracks the procedural and declarative states of a system.
 * Used to compile procedural state transitions into declarative time-to-state functions.
 */
export interface Track<TNumber extends number = number> {
  /**
   * The current time of the track used when compiling.
   */
  time: TNumber
  /**
   * The refs used in the procedural and declarative functions.
   * May be added to by useRef() calls.
   */
  refs: Ref<any>[]
  states: Map<Task<TNumber>, ProcessState<TNumber>>
  /**
   * Whether the track is currently running a declarative function. Used to prevent procedural / declarative functions being called from a declarative function.
   */
  isMaterialized: boolean
  /**
   * Whether the track is currently compiling or evaluating. Used to prevent `compile()` and `useCompiled()` being called from procedural / declarative functions.
   */
  isCompilingOrEvaluating: boolean
}

/**
 * The materialized state of a track at a specific time.
 */
export interface TrackMaterialized<TNumber extends number = number> {
  /**
   * The time of the fixed track.
   */
  time: TNumber
  /**
   * The values of the refs at the time of the fixed track.
   */
  refValues: Map<Ref<any>, any>
  /**
   * The copied states of the track at the time of the fixed track.
   */
  states: Map<Task<TNumber>, ProcessState<TNumber>>
}

/**
 * Create an empty track.
 * @returns An empty track.
 */
export function createTrack<TNumber extends number = number>(): Track<TNumber> {
  return { time: 0 as TNumber, refs: [], states: new Map(), isCompilingOrEvaluating: false, isMaterialized: false }
}

/**
 * Create a ref and add it to the track.
 * @param track The track to add the ref to.
 * @param v The initial value of the ref.
 * @returns The created ref.
 */
export function useRef<T, TNumber extends number = number>(track: Track<TNumber>, v: T): Ref<T> {
  if (track.isMaterialized || track.isCompilingOrEvaluating) {
    throw new Error('Cannot add a ref while compiling or evaluating.')
  }
  const ref = { current: v }
  track.refs.push(ref)
  return ref
}

function registerTask<TNumber extends number>(track: Track<TNumber>, task: Task<TNumber>, visited = new Set<Task<TNumber>>()) {
  if (visited.has(task) || track.states.has(task))
    return
  visited.add(task)

  const state: ProcessState<TNumber> = { type: task.type, done: false, progress: 0 as TNumber }
  if (task.type === 'any') {
    state.tasks = task.tasks
    for (const child of task.tasks) registerTask(track, child, visited)
  }
  track.states.set(task, state)
}

/**
 * Sleep for a specified duration.
 * @param duration The duration to sleep for.
 */
export function sleep<TNumber extends number = number>(duration: TNumber | number): TaskConstant<TNumber> {
  return { type: 'constant', duration: duration as TNumber, isSuspended: false }
}

/**
 * Run a procedural function as a task and add it to the track. Must not be called within a declarative function.
 * @param track The track to add the task to.
 * @param f The procedural function to run as a task. The function will be called immediately and can update the refs of the track. The function can yield Wait objects to specify the conditions for the function to be called again. When the function is suspended, it will not be called and the wait time will not be updated. When the function is resumed, it will continue from where it was suspended.
 * @returns A Task object that can be suspended and resumed.
 */
export function runProcedural<TNumber extends number = number>(track: Track<TNumber>, f: ProceduralFunction<TNumber>): TaskFunc<TNumber> {
  if (track.isMaterialized)
    throw new Error('Cannot run a procedural function while materialized.')
  const task: TaskFunc<TNumber> = { type: 'func', f, isSuspended: false }
  registerTask(track, task)
  return task
}

/**
 * Run a declarative function as a task and add it to the track. Must not be called within another declarative function.
 * @param track The track to add the task to.
 * @param f The declarative function to run as a task. The function will be called with the progress time as the argument, and can update the refs of the track. The function will be called every time the progress time is updated until the progress time reaches the duration of the task.
 * @param duration The duration of the task. Can be Infinity for infinite duration.
 * @returns A Task object that can be suspended and resumed.
 */
export function runDeclarative<TNumber extends number = number>(track: Track<TNumber>, f: (time: TNumber) => void, duration: TNumber | number): TaskDeclarative<TNumber> {
  if (track.isMaterialized)
    throw new Error('Cannot run a declarative function while materialized.')
  const task: TaskDeclarative<TNumber> = { type: 'declarative', f, duration: duration as TNumber, isSuspended: false }
  registerTask(track, task)
  return task
}

/**
 * Wait for all tasks to finish.
 */
export function all<TNumber extends number>(track: Track<TNumber>, tasks: Task<TNumber>[]): TaskFunc<TNumber> {
  return runProcedural(track, (function* () {
    for (const t of tasks) yield t
  })())
}

/**
 * Wait until any task finishes.
 */
export function any<TNumber extends number>(tasks: Task<TNumber>[]): TaskAny<TNumber> {
  return { type: 'any', tasks, isSuspended: false }
}

function processEvents<TNumber extends number>(track: Track<TNumber>): boolean {
  let wokeUpSomeone = false
  for (const [task, state] of track.states.entries()) {
    if (state.done || task.isSuspended)
      continue

    if (task.type === 'constant' || task.type === 'declarative') {
      if (Number(state.progress) >= Number(task.duration)) {
        state.done = true
        wokeUpSomeone = true
      }
    }
    else if (task.type === 'func') {
      if (!state.waitTarget || track.states.get(state.waitTarget)?.done) {
        const res = task.f.next()
        if (res.done) {
          state.done = true
          state.waitTarget = undefined
        }
        else {
          registerTask(track, res.value)
          state.waitTarget = res.value
        }
        wokeUpSomeone = true
      }
    }
    else if (task.type === 'any') {
      const winner = state.tasks?.find(t => track.states.get(t)?.done)
      if (winner) {
        state.done = true
        wokeUpSomeone = true
      }
    }
  }
  return wokeUpSomeone
}

/**
 * Compile the procedural states of the track into declarative time-to-state functions.
 * @param track The track to compile.
 * @param time The maximum time to compile up to. If procedural functions have side effects that are not captured by the track, it may be used instead of `useCompiled()` to get the state of the track at a specific time. If not Infinity, the declarative states will be run as well.
 * @returns An array of fixed tracks, which are the materialized states of the track at specific times when procedural states change. Each fixed track contains the time, the values of the refs, and the procedural and declarative states at that time.
 */
export function compile<TNumber extends number>(track: Track<TNumber>, time: TNumber = Infinity as TNumber): TrackMaterialized<TNumber>[] {
  if (track.isCompilingOrEvaluating)
    throw new Error('Cannot compile while compiling or evaluating.')

  const frames: TrackMaterialized<TNumber>[] = []
  track.time = 0 as TNumber
  track.isMaterialized = false
  track.isCompilingOrEvaluating = true

  while (track.time <= time) {
    while (processEvents(track));

    frames.push({
      time: track.time,
      refValues: new Map(track.refs.map(ref => [ref, ref.current])),
      states: new Map(Array.from(track.states.entries()).map(([k, v]) => [k, { ...v }])),
    })

    if (Array.from(track.states.values()).every(s => s.done))
      break

    let minDt = Infinity
    for (const [task, state] of track.states.entries()) {
      if ((task.type === 'constant' || task.type === 'declarative') && !state.done && !task.isSuspended) {
        minDt = Math.min(minDt, Number(task.duration) - Number(state.progress))
      }
    }

    if (minDt === Infinity)
      throw new Error('Deadlock detected: remaining time is Infinity for all active processes.')

    track.time = (Number(track.time) + minDt) as TNumber

    for (const [task, state] of track.states.entries()) {
      if (!state.done && !task.isSuspended) {
        if (task.type === 'constant' || task.type === 'declarative') {
          state.progress = (Number(state.progress) + minDt) as TNumber
          if (task.type === 'declarative')
            task.f(state.progress)
        }
      }
    }
  }

  track.isMaterialized = true
  track.isCompilingOrEvaluating = false
  return frames
}

/**
 * Convert compiled frames into a visible snapshot-friendly structure.
 */
export function toVisibleFrames<TNumber extends number>(frames: TrackMaterialized<TNumber>[]) {
  const firstFrame = frames[0]!
  return frames.map(frame => ({
    time: frame.time,
    refValues: new Map(Array.from(frame.refValues.entries()).map(([ref, value]) => [firstFrame.refValues.has(ref) ? 'Ref' : 'Unknown', value])),
  }))
}

/**
 * Evaluate compiled frames at a specific time.
 * @param track The track to evaluate. Required to update the refs.
 * @param frames The fixed tracks generated by `compile()`.
 * @param time The time to evaluate the track at. Must be non-negative.
 */
export function useCompiled<TNumber extends number>(track: Track<TNumber>, frames: TrackMaterialized<TNumber>[], time: TNumber): void {
  if (track.isCompilingOrEvaluating)
    throw new Error('Cannot evaluate while compiling or evaluating.')
  track.isCompilingOrEvaluating = true

  const fixedTrack = frames.findLast(frame => frame.time <= time)
  if (!fixedTrack) {
    track.isCompilingOrEvaluating = false
    throw new Error('No fixed track found for the given time.')
  }

  track.refs.forEach((ref) => {
    ref.current = fixedTrack.refValues.get(ref)
  })

  const dt = Number(time) - Number(fixedTrack.time)
  if (dt > 0) {
    for (const [task, state] of fixedTrack.states.entries()) {
      if (task.type === 'declarative' && !task.isSuspended && !state.done) {
        task.f(Math.min(Number(state.progress) + dt, Number(task.duration)) as TNumber)
      }
    }
  }

  track.isCompilingOrEvaluating = false
}
