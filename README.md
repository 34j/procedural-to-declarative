<!--
  -- This file is auto-generated from README.md. Changes should be made there.
  -->

# procedural-to-declarative

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

---

**📘Documentation**: [https://34j.github.io/procedural-to-declarative/](https://34j.github.io/procedural-to-declarative/)

**📦️NPM Package**: [https://www.npmjs.com/package/procedural-to-declarative](https://www.npmjs.com/package/procedural-to-declarative)

---

Compile procedural state transitions (do, wait, set, wait, ...) into declarative time-to-state functions (t -> do, set).

## Installation

```bash
npm install procedural-to-declarative
```

## Motivation

Video generation using TypeScript is a hot topic. Typically such package requires a function that maps time to state.

```ts
type DeclarativeFunction<T> = (time: number) => T | undefined
```

However, it's often more intuitive to write state transitions in a procedural way:

<!-- skip doccmd[all]: start -->

```ts
const x = useRef(0)
function proc() {
  sleep(1)
  x.current += 1
  sleep(1)
  x.current += 1
}
```

However if one would like to parallelize procudual functions, it turns out to be impossible, since the passed function cannot be "blocked" to sort the procedure (inner lines).


```ts
function proc() {
  const x = useRef(0)
  all([
    (() => {
      sleep(1)
      x.current += 1 // 00:01 (Unable to block here!)
      sleep(2)
      x.current += 2 // 00:03
    })(),
    (() => {
      sleep(2)
      x.current *= 2 // 00:02
    })(),
  ])
}
```

However, if we use `async/await` or `yield` (like `motion-canvas` did), we can "block" the function and sort the procedure.

```ts
async function proc() {
  const x = useRef(0)
  await all([
    (() => {
      await sleep(1) // (1)
      x.current += 1 // 00:01
      await sleep(2) // Blocked until (2) is executed
      x.current += 2 // 00:03
    })(),
    (() => {
      await sleep(2) // Blocked until (1) is executed (2)
      x.current *= 2 // 00:02
    })(),
  ])
}
```

```ts
function* proc() {
  const x = useRef(0)
  yield* all([
    (() => {
      yield sleep(1) // (1)
      x.current += 1 // 00:01
      yield sleep(2) // Blocked until (2) is executed
      x.current += 2 // 00:03
    })(),
    (() => {
      yield sleep(2) // Blocked until (1) is executed (2)
      x.current *= 2 // 00:02
    })(),
  ])
}
```

<!-- skip doccmd[all]: end -->

Our package uses the second approach.

## Usage

```ts
import { all, any, compile, createTrack, runDeclarative, runProcedural, sleep, useCompiled, useRef } from '../src/index.ts'

const track = createTrack<number>()
function* proc() {
  const x = useRef(0)
  yield sleep(1)
  x.current = 1
  yield runDeclarative(track, (time) => {
    x.current = 1 + time
  }, 1)
  yield sleep(1)
  x.current += 1
  yield sleep(1)
}
const compiled = compile(track, proc)
```

### Advanced Usage

```ts
import { all, any, compile, createTrack, runDeclarative, runProcedural, sleep, useCompiled, useRef } from '../src/index.ts'

const track = createTrack<number>()
function* proc() {
  const x = useRef(0)
  const y = useRef(0)
  task1 = runDeclarative((time) => {
    x.current = time
  })
  function* task2Func() {
    while (true) {
      y.current += x.current
      yield sleep(1)
    }
  }
  task2 = runProcedural(task2Func())
  yield task1.wait()
  task2.suspend()
}
const compiled = compile(track, proc)
```

## Comparison

<!-- skip doccmd[all]: start -->

- From our observation, none of the existing libraries support "waiting" while video / audio is playing.
- The comparison on the way of writing "animation" using static images is as follows:

### Motion Canvas / Revideo

```tsx
import { Circle, makeScene2D, } from '@revideo/2d'
import { all, createRef, makeProject, } from '@revideo/core'

/**
 * The Revideo scene
 */
const scene = makeScene2D('scene', function* (view) {
  const circle = createRef<Circle>()
  view.add(
    <Circle
      ref={circle}
      fill="lightseagreen"
    />
  )
  yield* all(
    circle().width(0).width(100, 1),
    circle().height(0).height(100, 2),
  )
})

/**
 * The final revideo project
 */
export default makeProject({
  scenes: [scene],
  settings: {
    // Example settings:
    shared: {
      size: { x: 100, y: 100 },
    },
  },
})
```

### [FrameScript](https://github.com/frame-script/FrameScript)

```tsx
import { useAnimation, useVariable } from '../src/lib/animation'
import { BEZIER_SMOOTH } from '../src/lib/animation/functions'
import { seconds } from '../src/lib/frame'
import { FillFrame } from '../src/lib/layout/fill-frame'

const x = useVariable(0)
const y = useVariable(0)

function scene() {
  useAnimation(async (ctx) => {
    await ctx.parallel([
      ctx.move(x).to(100, seconds(1), BEZIER_SMOOTH),
      ctx.move(y).to(100, seconds(2), BEZIER_SMOOTH)
    ])
  })

  return (
    <FillFrame style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: x.use(),
          height: y.use(),
        }}
      />
    </FillFrame>
  )
}
```

<!-- skip doccmd[all]: end -->

[build-img]:https://github.com/34j/procedural-to-declarative/actions/workflows/release.yml/badge.svg
[build-url]:https://github.com/34j/procedural-to-declarative/actions/workflows/release.yml
[downloads-img]:https://img.shields.io/npm/dt/procedural-to-declarative
[downloads-url]:https://www.npmtrends.com/procedural-to-declarative
[npm-img]:https://img.shields.io/npm/v/procedural-to-declarative
[npm-url]:https://www.npmjs.com/package/procedural-to-declarative
[issues-img]:https://img.shields.io/github/issues/34j/procedural-to-declarative
[issues-url]:https://github.com/34j/procedural-to-declarative/issues
[codecov-img]:https://codecov.io/gh/34j/procedural-to-declarative/branch/main/graph/badge.svg
[codecov-url]:https://codecov.io/gh/34j/procedural-to-declarative
[semantic-release-img]:https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]:https://github.com/semantic-release/semantic-release
[commitizen-img]:https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]:http://commitizen.github.io/cz-cli/


---
Generated from [README.md](README.md) by [`runmd`](https://github.com/broofa/runmd)
