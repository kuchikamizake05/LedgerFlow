/** A known validation or policy rejection has no successful operation to retry. */
export function canReleaseWalletRequestKey(status: number): boolean {
  return status === 400 || status === 403;
}
