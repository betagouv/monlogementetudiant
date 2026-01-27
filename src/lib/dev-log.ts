export const devLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    if (data !== undefined) {
      console.log(message, data)
    } else {
      console.log(message)
    }
  }
}
