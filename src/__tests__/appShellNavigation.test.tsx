/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ProductMenu } from "../layouts/AppShellV2";
import { closeParentDisclosure } from "../ui/disclosureMenu";

describe("app shell navigation menus", () => {
  it("closes an open product menu after selecting a destination", () => {
    render(
      <MemoryRouter>
        <ProductMenu
          label="League"
          active={false}
          links={[{ to: "/my-hq", label: "This Week", detail: "Your next decisions", icon: Sparkles }]}
        />
      </MemoryRouter>,
    );

    const menu = screen.getByText("League").closest("details");
    expect(menu).not.toBeNull();
    menu!.open = true;

    fireEvent.click(within(menu!).getByRole("link", { name: /This Week/ }));

    expect(menu).not.toHaveAttribute("open");
  });

  it("closes the nearest disclosure without changing another menu", () => {
    render(
      <>
        <details data-testid="selected" open><summary>Selected</summary><select aria-label="League"><option>League</option></select></details>
        <details data-testid="other" open><summary>Other</summary></details>
      </>,
    );

    closeParentDisclosure(screen.getByRole("combobox", { name: "League" }));

    expect(screen.getByTestId("selected")).not.toHaveAttribute("open");
    expect(screen.getByTestId("other")).toHaveAttribute("open");
  });
});
