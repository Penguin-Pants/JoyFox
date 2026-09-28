// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { FOCUS_KEY, rememberFocus, restoreFocus } from "../../src/ui/focus";

function draw(root: HTMLElement, html: string): void {
  root.innerHTML = html;
}

describe("focus across redraws", () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("section");
    document.body.append(root);
  });

  it("focuses the control with the same key after a redraw", () => {
    draw(root, `<button ${FOCUS_KEY}="remove:a">Remove</button>`);
    root.querySelector("button")!.focus();
    const memo = rememberFocus(root);
    draw(root, `<button ${FOCUS_KEY}="remove:a">Confirm removal</button>`);
    expect(document.activeElement).toBe(document.body);
    expect(restoreFocus(root, memo)).toBe(true);
    expect(document.activeElement?.textContent).toBe("Confirm removal");
  });

  it("keeps the caret of a text field", () => {
    draw(root, `<input ${FOCUS_KEY}="name" value="Hello world" />`);
    const input = root.querySelector("input")!;
    input.focus();
    input.setSelectionRange(3, 5);
    const memo = rememberFocus(root);
    draw(root, `<input ${FOCUS_KEY}="name" value="Hello world" />`);
    restoreFocus(root, memo);
    const next = root.querySelector("input")!;
    expect(document.activeElement).toBe(next);
    expect([next.selectionStart, next.selectionEnd]).toEqual([3, 5]);
  });

  it("uses the first usable fallback when the control is gone", () => {
    draw(root, `<button ${FOCUS_KEY}="delete:t1">Delete</button>`);
    root.querySelector("button")!.focus();
    const memo = rememberFocus(root);
    draw(
      root,
      `<button ${FOCUS_KEY}="add" disabled>Add</button><input ${FOCUS_KEY}="name" />`,
    );
    expect(restoreFocus(root, memo, ["add", "name"])).toBe(true);
    expect(document.activeElement).toBe(root.querySelector("input"));
  });

  it("does nothing when focus was outside the root or on an unkeyed control", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    expect(rememberFocus(root)).toBeUndefined();
    draw(root, `<button>Plain</button>`);
    root.querySelector("button")!.focus();
    expect(rememberFocus(root)).toBeUndefined();
    expect(restoreFocus(root, undefined, ["x"])).toBe(false);
  });

  it("skips a control inside a closed details element or a hidden block", () => {
    draw(root, `<button ${FOCUS_KEY}="save">Save</button>`);
    root.querySelector("button")!.focus();
    const memo = rememberFocus(root);
    draw(
      root,
      `<details><summary ${FOCUS_KEY}="summary">More</summary><button ${FOCUS_KEY}="save">Save</button></details><div hidden><button ${FOCUS_KEY}="other">Other</button></div>`,
    );
    expect(restoreFocus(root, memo, ["other", "summary"])).toBe(true);
    expect(document.activeElement?.textContent).toBe("More");
  });

  it("keeps the page still for the same control and scrolls for a moved one", () => {
    const calls: (FocusOptions | undefined)[] = [];
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options?: FocusOptions) {
      calls.push(options);
      focus.call(this, options);
    };
    try {
      draw(root, `<button ${FOCUS_KEY}="save">Save</button>`);
      root.querySelector("button")!.focus();
      const memo = rememberFocus(root);
      calls.length = 0;
      draw(root, `<button ${FOCUS_KEY}="save">Save</button>`);
      restoreFocus(root, memo);
      draw(root, `<p ${FOCUS_KEY}="heading" tabindex="-1">Records</p>`);
      restoreFocus(root, memo, ["heading"]);
      draw(root, `<button ${FOCUS_KEY}="save">Save</button>`);
      restoreFocus(root, { key: "save", scroll: true });
      expect(calls).toEqual([
        { preventScroll: true },
        { preventScroll: false },
        { preventScroll: false },
      ]);
    } finally {
      HTMLElement.prototype.focus = focus;
    }
  });
});
