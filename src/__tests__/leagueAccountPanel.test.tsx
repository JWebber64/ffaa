// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppSession } from "../lib/authSession";
import { LeagueAccountPanel } from "../features/league-season/LeagueAccountPanel";

const authMocks = vi.hoisted(() => ({
  session: null as AppSession | null,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../lib/useFirebaseSession", () => ({
  useFirebaseSession: () => authMocks.session,
}));

vi.mock("../lib/authSession", () => ({
  isPermanentFirebaseSession: (session: AppSession | null) => Boolean(session?.user.uid && !session.user.isAnonymous),
  signOutFirebaseSession: authMocks.signOut,
  upgradeFirebaseSessionWithGoogle: authMocks.signIn,
}));

afterEach(() => {
  cleanup();
  authMocks.session = null;
  authMocks.signIn.mockReset();
  authMocks.signOut.mockReset();
});

describe("LeagueAccountPanel", () => {
  it("offers sign-out for a permanent manager session", async () => {
    authMocks.session = {
      user: {
        uid: "manager-1",
        isAnonymous: false,
        email: "manager@example.com",
      },
      provider: "google.com",
    } as AppSession;

    render(<LeagueAccountPanel />);

    expect(screen.getByText("manager@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledOnce());
  });

  it("offers Google sign-in for an anonymous session", () => {
    authMocks.session = {
      user: {
        uid: "anonymous-1",
        isAnonymous: true,
        email: null,
      },
      provider: "anonymous",
    } as AppSession;

    render(<LeagueAccountPanel />);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
