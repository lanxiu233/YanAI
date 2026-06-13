import type { StoredAuthSession } from "../store/auth";

export type AuthGuardState = {
  isCheckingAuth: boolean;
  session: StoredAuthSession | null;
};

export function getInitialAuthGuardState(
  cachedSession: StoredAuthSession | null | undefined,
  _allowedRolesKey: string,
): AuthGuardState {
  if (cachedSession === undefined) {
    return {
      isCheckingAuth: true,
      session: null,
    };
  }

  if (!cachedSession) {
    return {
      isCheckingAuth: false,
      session: null,
    };
  }

  return {
    isCheckingAuth: false,
    session: cachedSession,
  };
}
