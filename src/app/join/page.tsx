import { PinForm } from "@/components/mobile/pin-form";
import { ko } from "@/messages/ko";

/** M1 PIN 입력(공개). 접속 주소로 들어온 피교육자용 */
export default function JoinPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 px-5 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-brand-700">{ko.join.title}</h1>
        <PinForm />
      </div>
    </main>
  );
}
