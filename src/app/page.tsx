import { redirect } from "next/navigation";

// Temporary until the homepage (spec 8.1, variant D) is built.
export default function Home() {
  redirect("/try");
}
