// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NativeLeagueFoundationPanel } from "../features/league-domain/NativeLeagueFoundationPanel";

vi.mock("../features/league-season/LeagueAccountPanel", () => ({
  LeagueAccountPanel: () => (
    <section aria-label="League manager account">
      <button type="button">Continue with Google</button>
    </section>
  ),
}));

vi.mock("../features/league-domain/leagueCommands", () => ({
  connectExternalLeague: vi.fn(),
  createNativeLeague: vi.fn(),
}));

afterEach(cleanup);

describe("NativeLeagueFoundationPanel", () => {
  it("offers permanent account sign-in before native league creation", () => {
    render(
      <MemoryRouter>
        <NativeLeagueFoundationPanel activeConnection={null} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("region", { name: "League manager account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create native league" })).toBeInTheDocument();
  });
});
