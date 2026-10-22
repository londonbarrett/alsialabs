import type { MyInvoicesResultDTO } from "@/actions/schemas/invoice"
import type { ProjectOptionDTO } from "@/actions/schemas/project"

export type MyInvoicesState = MyInvoicesResultDTO & {
  projects: ProjectOptionDTO[]
}

export type MyInvoicesAction = {
  type: "bindProject"
  invoiceId: string
  projectId: string | null
  projectName: string | null
}

export function myInvoicesReducer(
  state: MyInvoicesState,
  action: MyInvoicesAction
): MyInvoicesState {
  switch (action.type) {
    case "bindProject": {
      const invoice = state.invoices.find(
        (i) => i.id === action.invoiceId
      )
      if (!invoice) return state
      return {
        ...state,
        invoices: state.invoices.map((i) =>
          i.id === action.invoiceId
            ? {
                ...i,
                projectId: action.projectId,
                projectName: action.projectName,
              }
            : i
        ),
      }
    }
  }
}
