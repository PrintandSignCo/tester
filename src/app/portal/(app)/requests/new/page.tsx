import { PageHeader } from "@/components/ui";
import { RequestForm } from "@/components/request-form";
import { prisma } from "@/lib/db";

export const metadata = { title: "New job request" };

export default async function NewRequestPage() {
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } });
  return (
    <>
      <PageHeader title="Request a job" lede="Tell the shop the size, quantity, material and when you need it. Artwork can be PDF, AI, EPS, PNG or JPG." />
      <section className="card">
        <RequestForm products={products.map((product) => product.name)} />
      </section>
    </>
  );
}
