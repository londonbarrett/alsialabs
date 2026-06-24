import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">ALSIA Labs CRM</h1>
        <p className="text-muted-foreground max-w-md">
          Agricultura Limpia y Servicios Agropecuarios
        </p>
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Open Dashboard
        </Link>
      </div>
    </div>
  )
}
