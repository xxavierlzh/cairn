/** An Error with a status code. The app's error handler sends it back to the client as-is. */
export function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
