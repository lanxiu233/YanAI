import { describe, expect, it } from "vitest";

import { getInitialAuthGuardState } from "./auth-guard-state";
import type { StoredAuthSession } from "../store/auth";

const userSession: StoredAuthSession = {
  key: "user-token",
  role: "user",
  subjectId: "user-1",
  name: "User",
};

const adminSession: StoredAuthSession = {
  key: "admin-token",
  role: "admin",
  subjectId: "admin-1",
  name: "Admin",
};

describe("getInitialAuthGuardState", () => {
  it("uses a cached matching session without showing the checking state", () => {
    expect(getInitialAuthGuardState(userSession, "user")).toEqual({
      isCheckingAuth: false,
      session: userSession,
    });
  });

  it("keeps checking when no cache has been loaded yet", () => {
    expect(getInitialAuthGuardState(undefined, "user")).toEqual({
      isCheckingAuth: true,
      session: null,
    });
  });

  it("returns the cached session for redirect handling when the role does not match", () => {
    expect(getInitialAuthGuardState(adminSession, "user")).toEqual({
      isCheckingAuth: false,
      session: adminSession,
    });
  });
});
