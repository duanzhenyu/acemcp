import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/session";
import { LoginButton } from "./LoginButton";

export async function Header() {
  const user = await getCurrentSessionUser();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-white/[0.04] bg-[#0a0f1a]/80 px-6 py-4 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
          ACE Relay
        </span>
      </Link>
      <LoginButton user={user} />
    </header>
  );
}
