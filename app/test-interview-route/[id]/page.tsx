export default async function Test({ params }: { params: { id: string } }) {
  const { id } = await params;
  console.log("🧪 TEST ROUTE - ID:", id);
  return <div className="p-8"><h1>Test Route</h1><p>ID: {id}</p></div>;
}