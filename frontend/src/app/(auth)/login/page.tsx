import Image from "next/image";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center text-center">
      <Image src="/mascots/login_image.png" alt="" width={130} height={92} priority />
      <h1 className="mt-6 mb-8 font-serif text-3xl font-bold text-accent">Yay, You&apos;re Back!</h1>
      <div className="w-full text-left">
        <AuthForm mode="login" submitLabel="Login" />
      </div>
      <Link href="/register" className="mt-4 text-sm text-accent underline">
        Oops! I&apos;ve never been here before
      </Link>
    </div>
  );
}
