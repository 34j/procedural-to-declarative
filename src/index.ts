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
  done: boolean
}

/**
 * A task that completes after a fixed duration.
 */
export interface TaskConstant<TNumber extends number = number> extends TaskBase {
  type: 'constant'
  duration: TNumber
  progress: TNumber
}

export type ProceduralFunction<TNumber extends number> = IterableIterator<Task<TNumber>>

/**
 * A procedural task that advances by yielding waits.
 */
export interface TaskFunc<TNumber extends number = number> extends TaskBase {
  type: 'func'
  f: ProceduralFunction<TNumber>
  waitTarget?: Task<TNumber> | undefined
}

/**
 * A composite task that finishes when any child finishes.
 */
export interface TaskAny<TNumber extends number = number> extends TaskBase {
  type: 'any'
  tasks: Task<TNumber>[]
}

/**
 * A composite task that finishes when all children finish.
 */
export interface TaskAll<TNumber extends number = number> extends TaskBase {
  type: 'all'
  tasks: Task<TNumber>[]
}

/**
 * A declarative task evaluated from elapsed time.
 */
export interface TaskDeclarative<TNumber extends number = number> extends TaskBase {
  type: 'declarative'
  f: (time: TNumber) => void
  duration: TNumber
  progress: TNumber
}

export type Task<TNumber extends number = number>
  = | TaskConstant<TNumber>
    | TaskFunc<TNumber>
    | TaskAny<TNumber>
    | TaskDeclarative<TNumber>

/**
 * The data structure that tracks the procedural and declarative tasks of a system.
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
  /**
   * The active or registered tasks within this track.
   */
  tasks: Set<Task<TNumber>>
  /**
   * Whether the track is currently running a declarative function.
   * Used to prevent procedural / declarative functions being called from a declarative function.
   */
  isMaterialized: boolean
  /**
   * Whether the track is currently compiling or evaluating.
   * Used to prevent `compile()` and `useCompiled()` being called from procedural / declarative functions.
   */
  isCompilingOrEvaluating: boolean
}

/**
 * A lightweight snapshot of a task's state at a specific point in time.
 */
export interface TaskSnapshot<TNumber extends number = number> {
  done: boolean
  progress: TNumber
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
   * The snapshots of the tasks at the time of the fixed track.
   */
  taskSnapshots: Map<Task<TNumber>, TaskSnapshot<TNumber>>
}

/**
 * Create an empty track.
 * @returns An empty track.
 */
export function createTrack<TNumber extends number = number>(): Track<TNumber> {
  return { time: 0 as TNumber, refs: [], tasks: new Set(), isCompilingOrEvaluating: false, isMaterialized: false }
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

function registerTask<TNumber extends number>(track: Track<TNumber>, task: Task<TNumber>) {
  if (track.tasks.has(task))
    return
  track.tasks.add(task)

  if (task.type === 'any') {
    for (const child of task.tasks) {
      registerTask(track, child)
    }
  }
}

/**
 * Sleep for a specified duration.
 * @param duration The duration to sleep for.
 */
export function sleep<TNumber extends number = number>(duration: TNumber | number): TaskConstant<TNumber> {
  return { type: 'constant', duration: duration as TNumber, progress: 0 as TNumber, isSuspended: false, done: false }
}

/**
 * Run a procedural function as a task and add it to the track. Must not be called within a declarative function.
 * @param track The track to add the task to.
 * @param f The procedural function to run as a task.
 * @returns A Task object that can be suspended and resumed.
 */
export function runProcedural<TNumber extends number = number>(track: Track<TNumber>, f: ProceduralFunction<TNumber>): TaskFunc<TNumber> {
  if (track.isMaterialized)
    throw new Error('Cannot run a procedural function while materialized.')
  const task: TaskFunc<TNumber> = { type: 'func', f, isSuspended: false, done: false }
  registerTask(track, task)
  return task
}

/**
 * Run a declarative function as a task and add it to the track. Must not be called within another declarative function.
 * @param track The track to add the task to.
 * @param f The declarative function to run as a task.
 * @param duration The duration of the task. Can be Infinity for infinite duration.
 * @returns A Task object that can be suspended and resumed.
 */
export function runDeclarative<TNumber extends number = number>(track: Track<TNumber>, f: (time: TNumber) => void, duration: TNumber | number): TaskDeclarative<TNumber> {
  if (track.isMaterialized)
    throw new Error('Cannot run a declarative function while materialized.')
  const task: TaskDeclarative<TNumber> = { type: 'declarative', f, duration: duration as TNumber, progress: 0 as TNumber, isSuspended: false, done: false }
  registerTask(track, task)
  return task
}

/**
/**
 * Run multiple tasks in parallel and return a task that is finished when any of the tasks is finished.
 * @param tasks The tasks to run in parallel. The returned task will be finished when any of the tasks is finished.
 * @returns A Task object that can be suspended and resumed. wait() returns a Wait object that is finished when all of the tasks are finished. When the task is suspended, all of the tasks will not be suspended. When the task is resumed, all of the tasks will not be resumed.
 */
export function any<TNumber extends number>(tasks: Task<TNumber>[]): TaskAny<TNumber> {
  return { type: 'any', tasks, isSuspended: false, done: false }
}

function processEvents<TNumber extends number>(track: Track<TNumber>): boolean {
  let wokeUpSomeone = false
  for (const task of track.tasks) {
    if (task.done || task.isSuspended)
      continue

    if (task.type === 'constant' || task.type === 'declarative') {
      if (task.progress >= task.duration) {
        task.done = true
        wokeUpSomeone = true
      }
    }
    else if (task.type === 'func') {
      if (!task.waitTarget || task.waitTarget.done) {
        const res = task.f.next()
        if (res.done) {
          task.done = true
          task.waitTarget = undefined
        }
        else {
          registerTask(track, res.value)
          task.waitTarget = res.value
        }
        wokeUpSomeone = true
      }
    }
    else if (task.type === 'any') {
      if (task.tasks.some(t => t.done)) {
        task.done = true
        wokeUpSomeone = true
      }
    }
  }
  return wokeUpSomeone
}

/**
 * Compile the procedural states of the track into declarative time-to-state functions.
 * @param track The track to compile.
 * @param time The maximum time to compile up to.
 * @returns An array of fixed tracks, which are the materialized states.
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

    const taskSnapshots = new Map<Task<TNumber>, TaskSnapshot<TNumber>>()
    for (const task of track.tasks) {
      taskSnapshots.set(task, {
        done: task.done,
        progress: (task as any).progress ?? (0 as TNumber),
      })
    }

    frames.push({
      time: track.time,
      refValues: new Map(track.refs.map(ref => [ref, ref.current])),
      taskSnapshots,
    })

    if (Array.from(track.tasks).every(t => t.done))
      break

    let minDt = Infinity
    for (const task of track.tasks) {
      if ((task.type === 'constant' || task.type === 'declarative') && !task.done && !task.isSuspended) {
        minDt = Math.min(minDt, task.duration - task.progress) as TNumber
      }
    }

    if (minDt === Infinity)
      throw new Error('Deadlock detected: remaining time is Infinity for all active processes.')

    track.time = (track.time + minDt) as TNumber

    for (const task of track.tasks) {
      if (!task.done && !task.isSuspended) {
        if (task.type === 'constant' || task.type === 'declarative') {
          task.progress = (task.progress + minDt) as TNumber
          if (task.type === 'declarative')
            task.f(task.progress)
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

  const dt = (time - fixedTrack.time) as TNumber
  for (const [task, snapshot] of fixedTrack.taskSnapshots.entries()) {
    if (task.type === 'declarative' && !task.isSuspended && !snapshot.done) {
      task.f(Math.min(snapshot.progress + dt, task.duration) as TNumber)
    }
  }

  track.isCompilingOrEvaluating = false
}
