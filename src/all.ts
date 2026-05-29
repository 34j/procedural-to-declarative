import type { Task, TaskFunc, Track } from './index.ts'
import { runProcedural } from './index.ts'

/**
 * Run multiple tasks in parallel and return a task that is finished when all of the tasks are finished.
 * @param track The track to add the task to. Required to run the task using `runProcedural()`.
 * @param tasks The tasks to run in parallel. The returned task will be finished when all of the tasks are finished.
 * @returns A Task object that can be suspended and resumed. wait() returns a Wait object that is finished when all of the tasks are finished. When the task is suspended, all of the tasks will not be suspended. When the task is resumed, all of the tasks will not be resumed.
 */

export function all<TNumber extends number>(track: Track<TNumber>, tasks: Task<TNumber>[]): TaskFunc<TNumber> {
  return runProcedural(track, (function* () {
    for (const t of tasks) yield t
  })())
}
