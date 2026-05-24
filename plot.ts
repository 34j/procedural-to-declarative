/// <reference types="node" />

import type { ChartItem } from 'chart.js/auto'
import type { Ref, Track, TrackMaterialized } from './src/index.ts'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Chart } from 'chart.js/auto'
import { Canvas } from 'skia-canvas'
import { useCompiled } from './src/index.ts'

export async function plotHistory<TNumber extends number>(
  track: Track<TNumber>,
  fixedTracks: TrackMaterialized<TNumber>[],
  ref: Ref<number>,
  filePath: string,
  numPoints: number,
): Promise<void> {
  const maxTime = fixedTracks.length > 0 ? Number(fixedTracks.at(-1)!.time) : 0
  const points = Array.from({ length: numPoints }).flatMap((_, i) => {
    const time = numPoints > 1 ? (maxTime * i) / (numPoints - 1) : 0
    useCompiled(track, fixedTracks, time)
    return typeof ref.current === 'number' ? [{ x: time, y: ref.current }] : []
  })

  if (points.length === 0) {
    throw new Error('No numeric history found.')
  }

  const canvas = new Canvas(800, 450)
  const chart = new Chart(canvas as unknown as ChartItem, {
    type: 'line',
    data: {
      datasets: [{
        data: points,
      }],
    },
    options: {
      scales: {
        x: { type: 'linear', title: { display: true, text: 'time' } },
        y: { type: 'linear', title: { display: true, text: 'value' } },
      },
    },
  })

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, await canvas.toBuffer('png', { matte: 'white' }))
  chart.destroy()
}
