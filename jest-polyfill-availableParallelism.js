const os = require('os')
if (typeof os.availableParallelism !== 'function') {
  os.availableParallelism = () => {
    try { const cpus = os.cpus?.(); return Array.isArray(cpus) && cpus.length ? cpus.length : 1 } catch { return 1 }
  }
}
