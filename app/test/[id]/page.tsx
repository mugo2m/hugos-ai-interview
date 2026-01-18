export default async function TestPage({ params }: { params: { id: string } }) {
  const { id } = await params;

  console.log("🧪 [TestPage] Dynamic route working! ID:", id);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Test Dynamic Route</h1>
      <p className="mt-4">ID from URL: <strong>{id}</strong></p>
      <p className="mt-2">If you see this, dynamic routing works!</p>
    </div>
  );
}