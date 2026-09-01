import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock("@/lib/actions/stores", () => ({
  getEffectiveStoreId: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

const state = vi.hoisted(() => ({
  mock: null as unknown as {
    resetMocks(): void
    onSelect(table: unknown): { respond(data: unknown): unknown }
    onInsert(table: unknown): { respond(data: unknown): unknown }
    onUpdate(table: unknown): { respond(data: unknown): unknown }
    onDelete(table: unknown): { respond(data: unknown): unknown }
  },
}))

vi.mock("@/lib/drizzle/client", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js")
  const { mockDatabase } = await import("vitest-drizzle-mock")
  const schema = await import("@/lib/drizzle/schema")
  const db = drizzle.mock({ schema })
  state.mock = mockDatabase(db)
  return { db }
})

import * as schema from "@/lib/drizzle/schema"
import { auth, hasPermission } from "@/lib/auth"
import { getEffectiveStoreId } from "@/lib/actions/stores"
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  inviteClient,
  checkPhoneExists,
} from "@/lib/actions/clients"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)
const mockGetEffectiveStoreId = vi.mocked(getEffectiveStoreId)

describe("clients actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mock.resetMocks()
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user", name: "Test" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    mockHasPermission.mockResolvedValue(true)
    mockGetEffectiveStoreId.mockResolvedValue("store-1")
  })

  describe("getClients", () => {
    it("returns clients list", async () => {
      const fakeClients = [
        {
          id: "client-1",
          name: "John",
          phone: "123",
          location: null,
          comments: null,
          email: null,
          userId: null,
          store_id: "store-1",
        },
      ]
      state.mock.onSelect(schema.clientsTable).respond(fakeClients)

      const result = await getClients()

      expect(result.data).toEqual(fakeClients)
    })
  })

  describe("createClient", () => {
    it("creates a client with valid data", async () => {
      state.mock.onSelect(schema.clientsTable).respond([])
      state.mock.onInsert(schema.clientsTable).respond([{ id: "client-1" }])

      const result = await createClient({
        name: "John",
        phone: "123",
        location: "",
        comments: "",
        email: "",
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toBeDefined()
    })

    it("returns PHONE_ALREADY_EXISTS when phone exists", async () => {
      state.mock.onSelect(schema.clientsTable).respond([{ id: "client-1" }])

      const result = await createClient({
        name: "John",
        phone: "123",
        location: "",
        comments: "",
        email: "",
      })

      expect(result.serverError).toEqual({ code: "PHONE_ALREADY_EXISTS" })
    })

    it("rejects missing required fields", async () => {
      const result = await createClient({
        name: "",
        phone: "",
        location: "",
        comments: "",
        email: "",
      })

      expect(result.validationErrors).toBeDefined()
    })
  })

  describe("updateClient", () => {
    it("updates an existing client", async () => {
      state.mock.onSelect(schema.clientsTable).respond([])
      state.mock.onSelect(schema.clientsTable).respond([{ userId: null }])
      state.mock.onUpdate(schema.clientsTable).respond([{ id: "client-1" }])

      const result = await updateClient({
        id: "client-1",
        name: "Updated",
        phone: "456",
        location: "",
        comments: "",
        email: "",
      })

      expect(result.serverError).toBeUndefined()
    })

    it("returns PHONE_ALREADY_EXISTS when phone exists on other client", async () => {
      state.mock.onSelect(schema.clientsTable).respond([{ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" }])

      const result = await updateClient({
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Updated",
        phone: "123",
        location: "",
        comments: "",
        email: "",
      })

      expect(result.serverError).toEqual({ code: "PHONE_ALREADY_EXISTS" })
    })
  })

  describe("deleteClient", () => {
    it("deletes a client", async () => {
      state.mock.onDelete(schema.clientsTable).respond([{ id: "client-1" }])

      const result = await deleteClient({ id: "client-1" })

      expect(result.serverError).toBeUndefined()
    })
  })

  describe("checkPhoneExists", () => {
    it("returns exists false when phone empty", async () => {
      const result = await checkPhoneExists({ phone: "" })

      expect(result.data).toEqual({ exists: false })
    })

    it("returns exists true when phone exists", async () => {
      state.mock.onSelect(schema.clientsTable).respond([{ id: "client-1" }])

      const result = await checkPhoneExists({ phone: "123" })

      expect(result.data).toEqual({ exists: true })
    })
  })

  describe("inviteClient", () => {
    it("returns CLIENT_NOT_FOUND when client not found", async () => {
      state.mock.onSelect(schema.clientsTable).respond([])

      const result = await inviteClient({
        clientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      })

      expect(result.serverError).toEqual({ code: "CLIENT_NOT_FOUND" })
    })
  })
})
