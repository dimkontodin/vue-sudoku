// Runs the Android Gradle wrapper on any OS: node scripts/gradle.mjs <task> [gradle args…]
// Extra -P version properties can be passed through, e.g. -PversionName=1.2.0 -PversionCode=10200.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const androidDir = fileURLToPath(new URL('../android', import.meta.url))
const isWindows = process.platform === 'win32'
// Absolute path: cmd.exe does not reliably resolve a bare gradlew.bat from the cwd.
const wrapper = join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew')

const result = spawnSync(isWindows ? `"${wrapper}"` : wrapper, process.argv.slice(2), {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWindows,
})

process.exit(result.status ?? 1)
