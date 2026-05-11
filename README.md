
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

```ts
const tracker = new Tracker()
function proc() {
  const x = tracker.useRef(0)
  tracker.sleep(1)
  x.current += 1
  tracker.sleep(1)
  x.current += 1
}
compile(proc)(0) // 0
compile(proc)(0.5) // 0
compile(proc)(1) // 1
compile(proc)(1.5) // 1
compile(proc)(2) // 2
```

However if one would like to parallelize procudual functions, it turns out to be impossible, since the passed function cannot be "blocked" to sort the procedure (inner lines).

```ts
const tracker = new Tracker()
function proc() {
  const x = tracker.useRef(0)
  tracker.all([
    (() => {
      tracker.sleep(1)
      x.current += 1 // 00:01 (Unable to block here!)
      tracker.sleep(2)
      x.current += 2 // 00:03
    })(),
    (() => {
      tracker.sleep(2)
      x.current *= 2 // 00:02
    })(),
  ])
}
```

However, if we use `async/await` or `yield` (like `motion-canvas` did), we can "block" the function and sort the procedure.

```ts
const tracker = new Tracker()
async function proc() {
  const x = tracker.useRef(0)
  await tracker.all([
    (() => {
      await tracker.sleep(1) // (1)
      x.current += 1 // 00:01
      await tracker.sleep(2) // Blocked until (2) is executed
      x.current += 2 // 00:03
    })(),
    (() => {
      await tracker.sleep(2) // Blocked until (1) is executed (2)
      x.current *= 2 // 00:02
    })(),
  ])
}
```

```ts
const tracker = new Tracker()
function* proc() {
  const x = tracker.useRef(0)
  yield* tracker.all([
    (() => {
      yield tracker.sleep(1) // (1)
      x.current += 1 // 00:01
      yield tracker.sleep(2) // Blocked until (2) is executed
      x.current += 2 // 00:03
    })(),
    (() => {
      yield tracker.sleep(2) // Blocked until (1) is executed (2)
      x.current *= 2 // 00:02
    })(),
  ])
}
```

Our package uses the second approach.

## Usage

```ts
import { Tracker } from 'procedural-to-declarative'

const tracker = new Tracker<number>()
function* proc() {
  const x = tracker.useRef(0)
  tracker.sleep(1)
  x.current = 1
  yield tracker.run((time) => {
    x.current = 1 + time
  }, 1)
  tracker.sleep(1)
  x.current += 1
  tracker.sleep(1)
}
const x = tracker.compile(proc)
const eps = 1e-6
console.log(x(-eps)) // undefined
console.log(x(0)) // 0
console.log(x(1 - eps)) // 0
console.log(x(1)) // 1
console.log(x(1.5)) // 1.5
console.log(x(2)) // 2
console.log(x(3)) // 3
console.log(x(4)) // 3
console.log(x(4 + eps)) // undefined
```

### Advanced Usage

```ts
import { Tracker } from 'procedural-to-declarative'

const tracker = new Tracker<number>()
function* proc() {
  const x = tracker.useRef(0)
  const y = tracker.useRef(0)
  task1 = tracker.run((time) => {
    x.current = time
  }, 2)
  task2 = tracker.run(() => {
    while (true) {
      y.current += x
      yield tracker.sleep(1)
    }
  })
  task1.wait()
  task2.cancel()
}
```

## API

- `useRef(initial)`: 現在時刻の初期値を記録し、`ref.current` で値を更新する
- `sleep(dt)`: トラッカー内部時刻を `dt` 進める
- `compile(proc)`: 手続き関数を `time => state` 関数に変換し、`time` が `0..maxT` 外なら `undefined`
- `run(fn, duration)`: `DeclarativeFunction<void>` を現在時刻開始で `duration` の間だけ登録する

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
