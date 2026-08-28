/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ProductMenu } from "../layouts/AppShellV2";
import { getPrimaryDraftAction } from "../layouts/draftAction";
import { closeParentDisclosure } from "../ui/disclosureMenu";

describe("app shell navigation menus", () => {
  it("offers the offline workflow instead of a self-link from host setup", () => {
    expect(getPrimaryDraftAction("/host/setup")).toEqual({ to: "/offline-draft", label: "Offline Draft" });
    expect(getPrimaryDraftAction("/host/setup/")).toEqual({ to: "/offline-draft", label: "Offline Draft" });
    expect(getPrimaryDraftAction("/stats")).toEqual({ to: "/host/setup", label: "Start Draft" });
  });

  it("keeps only one desktop product menu open at a time", () => {
    render(
      <MemoryRouter>
        <nav aria-label="Primary navigation">
          <ProductMenu
            label="Draft"
            active={false}
            links={[{ to: "/host/setup", label: "Host a draft", detail: "Create a live room", icon: Sparkles }]}
          />
          <ProductMenu
            label="Research"
            active={false}
            links={[{ to: "/stats", label: "Rankings and stats", detail: "Rankings, values, and profiles", icon: Sparkles }]}
          />
        </nav>
      </MemoryRouter>,
    );

    const draftMenu = screen.getByText("Draft").closest("details");
    const researchMenu = screen.getByText("Research").closest("details");
    expect(draftMenu).not.toBeNull();
    expect(researchMenu).not.toBeNull();

    fireEvent.click(within(draftMenu!).getByText("Draft"));
    expect(draftMenu).toHaveAttribute("open");

    fireEvent.click(within(researchMenu!).getByText("Research"));

    expect(researchMenu).toHaveAttribute("open");
    expect(draftMenu).not.toHaveAttribute("open");
  });

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
