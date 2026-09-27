import type { Metadata } from "next";
import { Playground } from "./playground";

export const metadata: Metadata = { title: "Thử prototype · Blasphemous" };

export default function TryPage() {
  return <Playground />;
}
