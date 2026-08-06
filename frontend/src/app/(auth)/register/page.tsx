import Image from "next/image";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center text-center">
      <Image src="/mascots/register_image.png" alt="" width={130} height={92} priority />
      <h1 className="mt-6 mb-8 font-serif text-3xl font-bold text-accent">Yay, New Friend!</h1>
      <div className="w-full text-left">
        <AuthForm mode="register" submitLabel="Sign Up" />
      </div>
      <Link href="/login" className="mt-4 text-sm text-accent underline">
        We&apos;re already friends!
      </Link>
    </div>
  );
}
