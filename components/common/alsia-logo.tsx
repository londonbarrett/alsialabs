import Image from "next/image"
import { cn } from "cn"

export type LogoProps = {
  className?: string
}

export const Logo = ({ className }: LogoProps) => (
  <Image
    src="/agralia-logo.svg"
    alt="Agralia"
    width={176}
    height={40}
    className={cn("h-auto", className)}
  />
)
