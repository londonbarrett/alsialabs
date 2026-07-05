import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ClientInvoice } from "@/lib/actions/client-invoices"

interface InvoiceHistoryProps {
  invoices: ClientInvoice[]
}

export function InvoiceHistory({ invoices }: InvoiceHistoryProps) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold tracking-tight">
        Invoice History
      </h2>
      {invoices.length === 0 ? (
        <div className="rounded-md border p-6">
          <p className="text-center text-muted-foreground">
            No invoices yet
          </p>
        </div>
      ) : (
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Invoice #</TableHead>
                <TableHead scope="col">Type</TableHead>
                <TableHead scope="col">Date</TableHead>
                <TableHead scope="col">Total</TableHead>
                <TableHead scope="col">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">
                    {inv.invoiceNumber}
                  </TableCell>
                  <TableCell className="capitalize">{inv.type}</TableCell>
                  <TableCell>{inv.issueDate}</TableCell>
                  <TableCell>
                    $
                    {parseFloat(inv.grandTotal).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="capitalize">{inv.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
