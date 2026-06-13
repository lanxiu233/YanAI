"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getCachedAuthSession,
  getDefaultRouteForRole,
  getStoredAuthSession,
  type AuthRole,
  type StoredAuthSession,
} from "@/store/auth";
import { getInitialAuthGuardState } from "@/lib/auth-guard-state";

type UseAuthGuardResult = {
  isCheckingAuth: boolean;
  session: StoredAuthSession | null;
};

export function useAuthGuard(allowedRoles?: AuthRole[]): UseAuthGuardResult {
  const router = useRouter();
  const allowedRolesKey = (allowedRoles || []).join(",");
  const initialState = getInitialAuthGuardState(getCachedAuthSession(), allowedRolesKey);
  const [session, setSession] = useState<StoredAuthSession | null>(initialState.session);
  const [isCheckingAuth, setIsCheckingAuth] = useState(initialState.isCheckingAuth);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const roleList = allowedRolesKey ? (allowedRolesKey.split(",") as AuthRole[]) : [];
      const storedSession = await getStoredAuthSession();
      if (!active) {
        return;
      }

      if (!storedSession) {
        setSession(null);
        setIsCheckingAuth(false);
        router.replace(roleList.length === 1 && roleList[0] === "admin" ? "/admin-login" : "/login");
        return;
      }

      if (roleList.length > 0 && !roleList.includes(storedSession.role)) {
        setSession(storedSession);
        setIsCheckingAuth(false);
        router.replace(getDefaultRouteForRole(storedSession.role));
        return;
      }

      setSession(storedSession);
      setIsCheckingAuth(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [allowedRolesKey, router]);

  return { isCheckingAuth, session };
}

export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const storedSession = await getStoredAuthSession();
      if (!active) {
        return;
      }

      if (storedSession) {
        router.replace(getDefaultRouteForRole(storedSession.role));
        return;
      }

      setIsCheckingAuth(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  return { isCheckingAuth };
}
