import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  /** "outline" is the pill button (e.g. "+ New Note"); "solid" is a filled
   * full-width button (e.g. auth screens' "Login" / "Sign Up"). */
  variant?: "outline" | "solid";
  /** Renders as a Next.js Link styled like a button, instead of a <button>. */
  href?: string;
}

export function Button({
  icon,
  variant = "outline",
  className,
  children,
  href,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full border border-accent font-semibold text-accent transition-colors cursor-pointer",
    variant === "outline" && "bg-cream px-5 py-2.5 hover:bg-accent/10 active:bg-accent/15",
    variant === "solid" && "w-full bg-accent/10 px-5 py-3 hover:bg-accent/15 active:bg-accent/20",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {icon}
      {children}
    </button>
  );
}
