import type { Chart as ChartJs } from 'chart.js'

let chartModulePromise: Promise<typeof import('chart.js')> | null = null

/** Lazy-load Chart.js (keeps main bundle smaller for Vercel/PWA builds). */
export async function getChartConstructor(): Promise<typeof ChartJs> {
  if (!chartModulePromise) {
    chartModulePromise = import('chart.js').then(mod => {
      mod.Chart.register(
        mod.BarController,
        mod.BarElement,
        mod.CategoryScale,
        mod.LinearScale,
        mod.Tooltip,
        mod.DoughnutController,
        mod.ArcElement
      )
      return mod
    })
  }
  const mod = await chartModulePromise
  return mod.Chart
}
