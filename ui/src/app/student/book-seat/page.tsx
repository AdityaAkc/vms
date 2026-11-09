import type { Metadata } from "next";
import { BookSeatView } from "./book-seat-view";

export const metadata: Metadata = { title: "Book a seat" };

export default function Page() {
  return <BookSeatView />;
}
