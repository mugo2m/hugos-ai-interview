export default async function Test({ params }: { params: { id: string } }) {
  const { id } = await params;
  console.log("🧪 TEST ROUTE - ID:", id);
  return <div>Test: {id}</div>;
}