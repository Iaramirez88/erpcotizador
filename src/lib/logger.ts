type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function formatArg(arg: unknown) {
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      stack: arg.stack,
    }
  }

  return arg
}

function writeLog(level: LogLevel, args: unknown[]) {
  if (level === 'debug' && process.env.NODE_ENV === 'production') {
    return
  }

  const timestamp = new Date().toISOString()
  const payload = [
    `[${timestamp}]`,
    `[${level.toUpperCase()}]`,
    ...args.map(formatArg),
  ]

  if (level === 'error') {
    console.error(...payload)
    return
  }

  if (level === 'warn') {
    console.warn(...payload)
    return
  }

  console.log(...payload)
}

export const logger = {
  debug: (...args: unknown[]) => writeLog('debug', args),
  info: (...args: unknown[]) => writeLog('info', args),
  warn: (...args: unknown[]) => writeLog('warn', args),
  error: (...args: unknown[]) => writeLog('error', args),
}