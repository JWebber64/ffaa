// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TeamMark } from "../components/player/TeamMark";

describe("TeamMark", () => {
  it("uses full team helmet artwork", () => {
    const { container } = render(<TeamMark team="BUF" />);

    expect(screen.getByLabelText("BUF team").getAttribute("data-team")).toBe("BUF");
    expect(container.querySelector(".team-mark-image")?.getAttribute("src")).toBe(
      "https://www.fantasynerds.com/images/nfl/helmets/BUF.png",
    );
    expect(container.querySelector(".team-mark-code")?.hasAttribute("hidden")).toBe(true);
  });

  it("uses the image provider's Jacksonville abbreviation", () => {
    const { container } = render(<TeamMark team="JAX" />);

    expect(container.querySelector(".team-mark-image")?.getAttribute("src")).toBe(
      "https://www.fantasynerds.com/images/nfl/helmets/JAC.png",
    );
  });
});
