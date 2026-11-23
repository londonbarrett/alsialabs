// @vitest-environment jsdom
import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { MoneyInput, type MoneyInputProps } from "./money-input"

function ControlledMoneyInput({
  onChange: externalOnChange,
  ...props
}: Partial<MoneyInputProps> = {}) {
  const [value, setValue] = useState(props.value ?? "")
  const handleChange = (next: string) => {
    setValue(next)
    externalOnChange?.(next)
  }
  return <MoneyInput {...props} value={value} onChange={handleChange} />
}

describe("MoneyInput", () => {
  it("emits a canonical integer string and displays the formatted value", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledMoneyInput onChange={onChange} />)
    const input = screen.getByRole<HTMLInputElement>("textbox")

    await user.type(input, "150")

    expect(onChange).toHaveBeenLastCalledWith("150")
    expect(input.value).toBe("$150")
  })

  it("emits and displays a decimal value", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledMoneyInput onChange={onChange} />)
    const input = screen.getByRole<HTMLInputElement>("textbox")

    await user.type(input, "150.50")

    expect(onChange).toHaveBeenLastCalledWith("150.50")
    expect(input.value).toBe("$150.50")
  })

  it("keeps the trailing separator visible so the next digit becomes cents", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledMoneyInput onChange={onChange} />)
    const input = screen.getByRole<HTMLInputElement>("textbox")

    await user.type(input, "150.")

    expect(input.value).toBe("$150.")
    expect(input.selectionStart).toBe(5)
    expect(onChange).toHaveBeenLastCalledWith("150.")

    await user.type(input, "5")

    expect(onChange).toHaveBeenLastCalledWith("150.5")
    expect(input.selectionStart).toBe(6)
  })

  it("ignores an attempted decimal for a zero-fraction currency", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ControlledMoneyInput
        currency="COP"
        locale="es-CO"
        onChange={onChange}
      />
    )
    const input = screen.getByRole<HTMLInputElement>("textbox")

    await user.type(input, "150")

    expect(onChange).toHaveBeenLastCalledWith("150")

    await user.type(input, ".")

    expect(onChange).toHaveBeenLastCalledWith("150")
    expect(input.value).not.toContain(".")
    expect(onChange.mock.calls.every(([value]) => !value.includes("."))).toBe(
      true
    )
  })

  it("keeps the caret after the edited digit when editing the middle", async () => {
    const user = userEvent.setup()
    render(<ControlledMoneyInput value="1500" />)
    const input = screen.getByRole<HTMLInputElement>("textbox")

    // "$1,500": place the caret right after the "5".
    await user.type(input, "2", { initialSelectionStart: 4, initialSelectionEnd: 4 })

    expect(input.value).toBe("$15,200")
    expect(input.selectionStart).toBe(5)
  })

  it("keeps the whole value when Backspacing at the end of a grouped amount", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledMoneyInput value="1500" onChange={onChange} />)
    const input = screen.getByRole<HTMLInputElement>("textbox")

    expect(input.value).toBe("$1,500")
    // "$1,500" has six characters; the caret is at the end.
    await user.type(input, "{Backspace}", {
      initialSelectionStart: 6,
      initialSelectionEnd: 6,
    })

    // The raw value becomes "$1,50" — the comma is still grouping, so this is
    // 150 (not 1.50) and the field must show "$150" before any submit.
    expect(onChange).toHaveBeenLastCalledWith("150")
    expect(input.value).toBe("$150")
  })

  it("keeps the whole value when deleting in the middle of a grouped amount", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledMoneyInput value="1500" onChange={onChange} />)
    const input = screen.getByRole<HTMLInputElement>("textbox")

    // "$1,500": backspacing at index 5 removes the "0" after the "5" and also
    // leaves "$1,50".
    await user.type(input, "{Backspace}", {
      initialSelectionStart: 5,
      initialSelectionEnd: 5,
    })

    expect(onChange).toHaveBeenLastCalledWith("150")
    expect(input.value).toBe("$150")
  })
})
