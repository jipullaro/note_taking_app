"use client";

import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { EyeIcon, EyeOffIcon } from "./icons";

export function PasswordInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={cn(
        "flex items-center rounded-lg border border-accent/60 bg-cream px-4 focus-within:border-accent",
        className
      )}
    >
      <input
        type={visible ? "text" : "password"}
        className="w-full bg-transparent py-3 text-ink placeholder:text-ink/50 outline-none"
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="shrink-0 text-ink/50 hover:text-ink cursor-pointer"
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}
