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
export type Task<TNumber extends number = number>
  = | TaskConstant<TNumber>
    | TaskFunc<TNumber>
    | TaskAny<TNumber>
    | TaskDeclarative<TNumber>

export interface TaskBase<TNumber extends number = number> {
  _type?: TNumber
  _track?: Track<TNumber>
  _isSuspended?: boolean
  _suspensionMode?: 'propagate' | 'local'
  isSuspended: boolean
  wait: () => Task<TNumber>
}

/**
 * A task that completes after a fixed duration.
 */
export interface TaskConstant<TNumber extends number = number> extends TaskBase<TNumber> {
  type: 'constant'
  duration: TNumber
}

export type ProceduralFunction<TNumber extends number> = IterableIterator<Task<TNumber>>

/**
 * A procedural task that advances by yielding waits.
 */
export interface TaskFunc<TNumber extends number = number> extends TaskBase<TNumber> {
  type: 'func'
  f: ProceduralFunction<TNumber>
}

/**
 * A composite task that finishes when any child finishes.
 */
export interface TaskAny<TNumber extends number = number> extends TaskBase<TNumber> {
  type: 'any'
  tasks: Task<TNumber>[]
}

/**
 * A declarative task evaluated from elapsed time.
 */
export interface TaskDeclarative<TNumber extends number = number> extends TaskBase<TNumber> {
  type: 'declarative'
  f: (time: TNumber) => void
  duration: TNumber
}

export type ProcessState<TNumber extends number = number>
  = | { type: 'constant', done: boolean, suspended: boolean, progress: TNumber }
    | { type: 'func', done: boolean, suspended: boolean, waitTarget: Task<TNumber> | undefined }
    | { type: 'any', done: boolean, suspended: boolean, tasks: Task<TNumber>[] }
    | { type: 'declarative', done: boolean, suspended: boolean, progress: TNumber }

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

function installSuspensionProperty<TNumber extends number>(task: TaskBase<TNumber>) {
  Object.defineProperty(task, 'isSuspended', {
    get() {
      return task._isSuspended ?? false
    },
    set(value: boolean) {
      if (task._isSuspended === value)
        return
      task._isSuspended = value
      const taskTrack = task._track
      if (taskTrack) {
        setTaskSuspended(taskTrack, task as Task<TNumber>, value)
      }
    },
    enumerable: true,
    configurable: true,
  })
}

function registerTask<TNumber extends number>(track: Track<TNumber>, task: Task<TNumber>, visited = new Set<Task<TNumber>>()) {
  if (visited.has(task))
    return
  visited.add(task)

  task._track = track
  if (track.states.has(task))
    return

  if (task.type === 'constant') {
    track.states.set(task, { type: 'constant', done: false, suspended: Boolean(task._isSuspended), progress: 0 as TNumber })
  }
  else if (task.type === 'func') {
    track.states.set(task, { type: 'func', done: false, suspended: Boolean(task._isSuspended), waitTarget: undefined })
  }
  else if (task.type === 'any') {
    track.states.set(task, { type: 'any', done: false, suspended: Boolean(task._isSuspended), tasks: task.tasks })
    for (const child of task.tasks) {
      registerTask(track, child, visited)
    }
  }
  else if (task.type === 'declarative') {
    track.states.set(task, { type: 'declarative', done: false, suspended: Boolean(task._isSuspended), progress: 0 as TNumber })
  }

  if (task._isSuspended) {
    setTaskSuspended(track, task, true, visited)
  }
}

/**
 * Sleep for a specified duration.
 * @param duration The duration to sleep for.
 */
export function sleep<TNumber extends number = number>(duration: TNumber | number): TaskConstant<TNumber> {
  const task = {
    type: 'constant',
    duration: duration as TNumber,
    _isSuspended: false,
    _suspensionMode: 'local' as const,
    wait: () => task,
  } as TaskConstant<TNumber>
  installSuspensionProperty(task)
  return task
}

/**
 * Run a procedural function as a task and add it to the track. Must not be called within a declarative function.
 * @param track The track to add the task to.
 * @param f The procedural function to run as a task. The function will be called immediately and can update the refs of the track. The function can yield Wait objects to specify the conditions for the function to be called again. When the function is suspended, it will not be called and the wait time will not be updated. When the function is resumed, it will continue from where it was suspended.
 * @returns A Task object that can be suspended and resumed. wait() returns a Wait object that specifies the conditions for the task to be finished. When the task is suspended, the procedural function will not be called and the wait time will not be updated. When the task is resumed, the procedural function will continue from where it was suspended.
 */
export function runProcedural<TNumber extends number = number>(track: Track<TNumber>, f: ProceduralFunction<TNumber>, suspensionMode: 'propagate' | 'local' = 'propagate'): TaskFunc<TNumber> {
  if (track.isMaterialized) {
    throw new Error('Cannot run a procedural function while materialized.')
  }
  const task = {
    type: 'func',
    f,
    _track: track,
    _isSuspended: false,
    _suspensionMode: suspensionMode,
    wait: () => task,
  } as TaskFunc<TNumber>
  installSuspensionProperty(task)
  registerTask(track, task)
  return task
}

/**
 * Run a declarative function as a task and add it to the track. Must not be called within another declarative function.
 * @param track The track to add the task to.
 * @param f The declarative function to run as a task. The function will be called with the progress time as the argument, and can update the refs of the track. The function will be called every time the progress time is updated until the progress time reaches the duration of the task.
 * @param duration The duration of the task. Can be Infinity for infinite duration.
 * @returns A Task object that can be suspended and resumed. wait() returns a Wait object that specifies the duration of the task. When the task is suspended, the progress time will not be updated and the function will not be called. When the task is resumed, the progress time will continue from where it was suspended.
 */
export function runDeclarative<TNumber extends number = number>(track: Track<TNumber>, f: (time: TNumber) => void, duration: TNumber | number): TaskDeclarative<TNumber> {
  if (track.isMaterialized) {
    throw new Error('Cannot run a declarative function while materialized.')
  }
  const task = {
    type: 'declarative',
    f,
    duration: duration as TNumber,
    _track: track,
    _isSuspended: false,
    _suspensionMode: 'local' as const,
    wait: () => task,
  } as TaskDeclarative<TNumber>
  installSuspensionProperty(task)
  registerTask(track, task)
  return task
}

/**
 * Wait for all tasks to finish.
 */
export function all<TNumber extends number>(track: Track<TNumber>, tasks: Task<TNumber>[]): TaskFunc<TNumber> {
  return runProcedural(
    track,
    (function* () {
      for (const t of tasks) {
        yield t
      }
    })(),
    'local',
  )
}

/**
 * Wait until any task finishes.
 */
export function any<TNumber extends number>(tasks: Task<TNumber>[]): TaskAny<TNumber> {
  const task = {
    type: 'any',
    tasks,
    _isSuspended: false,
    _suspensionMode: 'local' as const,
    wait: () => task,
  } as TaskAny<TNumber>
  installSuspensionProperty(task)
  return task
}

function setTaskSuspended<TNumber extends number>(track: Track<TNumber>, task: Task<TNumber>, isSuspended: boolean, visited = new Set<Task<TNumber>>()) {
  if (visited.has(task))
    return
  visited.add(task)

  task._isSuspended = isSuspended

  const state = track.states.get(task)
  if (!state || state.done)
    return

  state.suspended = isSuspended

  if (task._suspensionMode !== 'propagate')
    return

  if (state.type === 'func' && state.waitTarget) {
    setTaskSuspended(track, state.waitTarget, isSuspended, visited)
  }
}

function cancel<TNumber extends number>(track: Track<TNumber>, task: Task<TNumber>) {
  const state = track.states.get(task)
  if (!state || state.done)
    return

  state.done = true
  if (state.type === 'func' && state.waitTarget) {
    cancel(track, state.waitTarget)
  }
  else if (state.type === 'any') {
    state.tasks.forEach(t => cancel(track, t))
  }
}

function processEvents<TNumber extends number>(track: Track<TNumber>): boolean {
  let wokeUpSomeone = false
  const entries = Array.from(track.states.entries())

  for (const [task, state] of entries) {
    if (state.done || state.suspended)
      continue

    switch (state.type) {
      case 'constant': {
        if (state.progress >= (task as TaskConstant<TNumber>).duration) {
          state.done = true
          wokeUpSomeone = true
        }
        break
      }
      case 'declarative': {
        if (state.progress >= (task as TaskDeclarative<TNumber>).duration) {
          state.done = true
          wokeUpSomeone = true
        }
        break
      }
      case 'func': {
        if (!state.waitTarget || track.states.get(state.waitTarget)?.done) {
          const res = (task as TaskFunc<TNumber>).f.next()
          if (res.done) {
            state.done = true
            state.waitTarget = undefined
          }
          else {
            const nextTask = res.value
            registerTask(track, nextTask)
            state.waitTarget = nextTask
          }
          wokeUpSomeone = true
        }
        break
      }
      case 'any': {
        const winner = state.tasks.find(t => track.states.get(t)?.done)
        if (winner) {
          state.done = true
          wokeUpSomeone = true
          state.tasks.forEach((child) => {
            if (child !== winner)
              cancel(track, child)
          })
        }
        break
      }
    }
  }

  return wokeUpSomeone
}

function cloneStates<TNumber extends number>(states: Map<Task<TNumber>, ProcessState<TNumber>>): Map<Task<TNumber>, ProcessState<TNumber>> {
  const cloned = new Map<Task<TNumber>, ProcessState<TNumber>>()
  for (const [key, value] of states.entries()) {
    cloned.set(key, { ...value } as ProcessState<TNumber>)
  }
  return cloned
}

/**
 * Compile the procedural states of the track into declarative time-to-state functions.
 * @param track The track to compile.
 * @param time The maximum time to compile up to. If procedural functions have side effects that are not captured by the track, it may be used instead of `useCompiled()` to get the state of the track at a specific time. If not Infinity, the declarative states will be run as well.
 * @returns An array of fixed tracks, which are the materialized states of the track at specific times when procedural states change. Each fixed track contains the time, the values of the refs, and the procedural and declarative states at that time.
 */
export function compile<TNumber extends number>(track: Track<TNumber>, time: TNumber = Infinity as TNumber): TrackMaterialized<TNumber>[] {
  if (track.isCompilingOrEvaluating) {
    throw new Error('Cannot compile while compiling or evaluating.')
  }

  const frames: TrackMaterialized<TNumber>[] = []
  track.time = 0 as TNumber
  track.isMaterialized = false
  track.isCompilingOrEvaluating = true

  while (track.time <= time) {
    let isActive = true
    while (isActive) {
      isActive = processEvents(track)
    }

    frames.push({
      time: track.time,
      refValues: new Map(track.refs.map(ref => [ref, ref.current])),
      states: cloneStates(track.states),
    })

    if (Array.from(track.states.values()).every(state => state.done)) {
      break
    }

    let minDt = Infinity
    for (const [task, state] of track.states.entries()) {
      if ((state.type === 'constant' || state.type === 'declarative') && !state.done && !state.suspended) {
        const duration = task.type === 'constant'
          ? (task as TaskConstant<TNumber>).duration
          : (task as TaskDeclarative<TNumber>).duration
        const remaining = Number(duration) - Number(state.progress)
        if (remaining < minDt) {
          minDt = remaining
        }
      }
    }

    if (minDt === Infinity) {
      throw new Error('Deadlock detected: remaining time is Infinity for all active processes.')
    }

    track.time = (Number(track.time) + minDt) as TNumber

    for (const [task, state] of track.states.entries()) {
      if (!state.done && !state.suspended) {
        if (state.type === 'constant') {
          state.progress = (Number(state.progress) + minDt) as TNumber
        }
        else if (state.type === 'declarative') {
          state.progress = (Number(state.progress) + minDt) as TNumber
          (task as TaskDeclarative<TNumber>).f(state.progress)
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
export function toVisibleFixedTracks<TNumber extends number>(fixedTracks: ReturnType<typeof compile<TNumber>>) {
  const firstFrame = fixedTracks[0]!
  return fixedTracks.map((frame) => {
    return {
      time: frame.time,
      refValues: new Map(Array.from(frame.refValues.entries()).map(([ref, value]) => [firstFrame.refValues.has(ref) ? 'Ref' : 'Unknown', value])),
    }
  })
}

/**
 * Evaluate compiled frames at a specific time.
 * @param track The track to evaluate. Required to update the refs.
 * @param fixedTracks The fixed tracks generated by `compile()`.
 * @param time The time to evaluate the track at. Must be non-negative.
 */
export function useCompiled<TNumber extends number>(track: Track<TNumber>, fixedTracks: TrackMaterialized<TNumber>[], time: TNumber): void {
  if (track.isCompilingOrEvaluating) {
    throw new Error('Cannot evaluate while compiling or evaluating.')
  }
  track.isCompilingOrEvaluating = true

  const fixedTrack = fixedTracks.findLast(frame => frame.time <= time)
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
      if (state.type === 'declarative' && !state.suspended && !state.done) {
        let progress = Number(state.progress) + dt
        const duration = Number((task as TaskDeclarative<TNumber>).duration)
        if (progress > duration) {
          progress = duration
        }
        ;(task as TaskDeclarative<TNumber>).f(progress as TNumber)
      }
    }
  }

  track.isCompilingOrEvaluating = false
}
