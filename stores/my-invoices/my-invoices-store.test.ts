import type { MyInvoiceDTO } from "@/actions/schemas/invoice"
import type { ProjectOptionDTO } from "@/actions/schemas/project"
import { describe, expect, it } from "vitest"
import {
  myInvoicesReducer,
  type MyInvoicesState,
} from "./my-invoices-reducer"
import { createMyInvoicesStore } from "./my-invoices-store"

function makeInvoice(
  id: string,
  overrides: Partial<MyInvoiceDTO> = {}
): MyInvoiceDTO {
  return {
    id,
    store_id: null,
    type: "product",
    invoiceNumber: "INV-001",
    clientId: "client-1",
    userId: null,
    status: "sent",
    issueDate: "2024-01-15",
    dueDate: null,
    paidAmount: "0.00",
    notes: null,
    subtotal: "100.00",
    discountTotal: "0.00",
    taxTotal: "0.00",
    grandTotal: "100.00",
    projectId: null,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    outstandingBalance: "100.00",
    projectName: null,
    ...overrides,
  }
}

function makeProject(id: string, name: string): ProjectOptionDTO {
  return {
    id,
    primaryOwnerId: "user-1",
    categoryId: "cat-1",
    name,
    description: null,
    status: "active",
    startDate: "2024-01-01",
    endDate: null,
    location: null,
    budget: null,
    color: "#3b82f6",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    categorySlug: null,
    categoryName: null,
    ownerName: "Jane Doe",
  }
}

function makeSeed(
  invoices: MyInvoiceDTO[],
  clientId: string | null = null,
  projects: ProjectOptionDTO[] = []
): MyInvoicesState {
  return { clientId, invoices, projects }
}

describe("myInvoicesReducer", () => {
  const a = makeInvoice("a")
  const b = makeInvoice("b")

  it("bindProject patches projectId and projectName", () => {
    const state = makeSeed([a, b], null, [
      makeProject("p1", "Project X"),
    ])
    const next = myInvoicesReducer(state, {
      type: "bindProject",
      invoiceId: "a",
      projectId: "project-1",
      projectName: "Project X",
    })

    expect(next.invoices[0].projectId).toBe("project-1")
    expect(next.invoices[0].projectName).toBe("Project X")
    expect(next.invoices[1]).toBe(b)
    expect(next.projects).toBe(state.projects)
  })

  it("clears projectId and projectName when projectId is null", () => {
    const bound = makeInvoice("a", {
      projectId: "project-1",
      projectName: "Project X",
    })
    const next = myInvoicesReducer(makeSeed([bound]), {
      type: "bindProject",
      invoiceId: "a",
      projectId: null,
      projectName: null,
    })

    expect(next.invoices[0].projectId).toBeNull()
    expect(next.invoices[0].projectName).toBeNull()
  })

  it("returns the same state for an unknown invoiceId", () => {
    const state = makeSeed([a])
    expect(
      myInvoicesReducer(state, {
        type: "bindProject",
        invoiceId: "nope",
        projectId: "p",
        projectName: "P",
      })
    ).toBe(state)
  })
})

describe("createMyInvoicesStore", () => {
  it("seeds committed and optimistic from the seed", () => {
    const seed = makeSeed(
      [makeInvoice("a"), makeInvoice("b")],
      "client-1",
      [makeProject("p1", "Project X")]
    )
    const store = createMyInvoicesStore(seed)

    expect(store.getState().committed).toEqual(seed)
    expect(store.getState().optimistic).toEqual(seed)
    expect(store.getState().optimistic.projects).toEqual(seed.projects)
    expect(store.getState().pending).toHaveLength(0)
  })

  it("discard reverts a pending bindProject", () => {
    const store = createMyInvoicesStore(makeSeed([makeInvoice("a")]))
    const id = store.getState().pend({
      type: "bindProject",
      invoiceId: "a",
      projectId: "project-1",
      projectName: "Project X",
    })
    expect(store.getState().optimistic.invoices[0].projectId).toBe(
      "project-1"
    )

    store.getState().discard(id)

    expect(store.getState().committed.invoices[0].projectId).toBeNull()
    expect(
      store.getState().committed.invoices[0].projectName
    ).toBeNull()
    expect(store.getState().optimistic.invoices[0].projectId).toBeNull()
    expect(
      store.getState().optimistic.invoices[0].projectName
    ).toBeNull()
  })

  it("reseedFromServer replaces the whole state", () => {
    const store = createMyInvoicesStore(makeSeed([makeInvoice("a")]))
    const next = makeSeed([makeInvoice("b")], "client-9", [
      makeProject("p9", "New Project"),
    ])

    store.getState().reseedFromServer(next)

    expect(store.getState().committed).toEqual(next)
    expect(store.getState().optimistic).toEqual(next)
    expect(store.getState().optimistic.projects).toEqual(next.projects)
  })
})
