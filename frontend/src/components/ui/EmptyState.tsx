import Image from "next/image";

export function EmptyState({
  message = "I'm just here waiting for your charming notes…",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
      <Image
        src="/mascots/empty_state.png"
        alt=""
        width={220}
        height={172}
        priority={false}
      />
      <p className="text-lg text-accent">{message}</p>
    </div>
  );
}
