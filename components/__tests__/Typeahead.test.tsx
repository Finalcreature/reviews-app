import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Typeahead from "../Typeahead";
import { vi } from "vitest";

describe("Typeahead", () => {
  test("shows object suggestions and Add option", async () => {
    const fetchSuggestions = async (q: string) => {
      return [
        { id: "1", name: "Action" },
        { id: "2", name: "RPG" },
      ];
    };

    const onSelect = vi.fn();
    const onChange = vi.fn();

    render(
      <Typeahead
        value=""
        onChange={onChange}
        fetchSuggestions={fetchSuggestions}
        onSelect={onSelect}
        suggestionToString={(s) =>
          typeof s === "string" ? s : (s as any).name
        }
        allowAdd={true}
        placeholder="Test"
      />
    );

    const input = screen.getByPlaceholderText("Test");
    fireEvent.change(input, { target: { value: "R" } });

    await waitFor(() => expect(screen.getByText("RPG")).toBeInTheDocument());

    fireEvent.click(screen.getByText("RPG"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }));
  });
});
