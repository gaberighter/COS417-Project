import type { Ref } from 'vue'

declare function useUserSession(): {
  loggedIn: Ref<boolean>
  user: Ref<Record<string, string> | null>
  clear: () => Promise<void>
}

declare function setUserSession(
  event: unknown,
  payload: {
    user: Record<string, unknown>
    loggedInAt: number
  },
): Promise<void>

declare function requireUserSession(event: unknown): Promise<void>
