export const devLog = (message: string, data?: unknown) => {
  if (process.env.ENABLE_PROXY_LOGS) {
    if (data !== undefined) {
      console.log(message, data)
    } else {
      console.log(message)
    }
  }
}
