import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-accent/60 bg-cream px-4 py-3 text-ink placeholder:text-ink/50 outline-none focus:border-accent",
        className
      )}
      {...props}
    />
  );
}
