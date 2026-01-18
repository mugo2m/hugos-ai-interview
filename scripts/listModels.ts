import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.ELLEVEN_API_KEY;

if (!API_KEY) {
  throw new Error("Please set ELLEVEN_API_KEY in your .env file");
}

interface Model {
  name: string;
  version: string;
}

interface ModelsResponse {
  models: Model[];
  nextPageToken?: string;
}

async function listModels() {
  let allModels: Model[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const url = new URL("https://api.ellevenlabs.com/v1/models");
    url.searchParams.append("key", API_KEY!); // non-null assertion

    if (nextPageToken) url.searchParams.append("pageToken", nextPageToken);

    const res = await fetch(url.toString());
    const data: ModelsResponse = await res.json() as ModelsResponse;

    allModels.push(...data.models);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  console.log("Available Models:");
  console.table(allModels.map(m => ({ Name: m.name, Version: m.version })));
}

listModels().catch(console.error);
