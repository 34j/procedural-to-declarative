
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

Compile procedural async state transitions into declarative time functions.

## Installation

```bash
npm install procedural-to-declarative
```

## Usage

```ts
import { Tracker } from 'procedural-to-declarative'

const tracker = new Tracker<number>()
async function proc() {
  const [, setX] = tracker.useState(0)
  await tracker.sleep(1)
  setX(1)
  await tracker.sleep(1)
  setX(2)
}
const x = await tracker.compile(proc)

x(0.5) // 0
x(2.5) // 2
```

## API

- `useState(initial)`: 現在時刻の初期値を記録し、`setState` を返す
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
