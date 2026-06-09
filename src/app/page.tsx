"use client";

import BarrierFreeDashboard from "@/components/dashboard/BarrierFreeDashboard";
import ChatBot from "@/components/chat/ChatBot";

export default function Home() {
  return (
    <main className="min-h-screen w-full antialiased overflow-x-hidden">
      <BarrierFreeDashboard />
      <ChatBot />
    </main>
  );
}
