// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeagueWorkspaceMark } from "../layouts/LeagueWorkspaceLayout";

describe("League workspace manager mark", () => {
  it("renders the saved Sleeper manager avatar as decorative team context", () => {
    const { container } = render(
      <LeagueWorkspaceMark
        avatarUrl="https://sleepercdn.com/avatars/thumbs/manager-avatar"
        teamName="Sunday Best"
      />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "https://sleepercdn.com/avatars/thumbs/manager-avatar");
    expect(image).toHaveAttribute("alt", "");
  });

  it("falls back to team initials when the avatar is missing or fails", () => {
    const { container, rerender } = render(<LeagueWorkspaceMark teamName="Sunday Best" />);
    expect(screen.getByText("SU")).toBeInTheDocument();

    rerender(<LeagueWorkspaceMark avatarUrl="https://example.com/broken.png" teamName="Sunday Best" />);
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText("SU")).toBeInTheDocument();
  });
});
