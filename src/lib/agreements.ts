export const MAX_AGREEMENTS_PER_SESSION = 10

export function getSessionAgreementLimitErrorMessage(limit = MAX_AGREEMENTS_PER_SESSION) {
  return `A session can contain at most ${limit} files`
}
