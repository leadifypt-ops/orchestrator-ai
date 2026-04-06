"use client";

import { useState } from "react";

export default function ManychatIntegrationPage() {
  const endpoint = `${process.env.NEXT_PUBLIC_APP_URL}/api/public/leads`;
  const secret = "autoforge-secret";

  const example = `{
  "phone": "{{phone}}",
  "name": "{{name}}",
  "instagram": "{{username}}",
  "message": "{{last_input}}",
  "source": "manychat",
  "channel": "instagram",
  "secret": "${secret}"
}`;

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    alert("Copiado");
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">
        Integração ManyChat
      </h1>

      {/* Endpoint */}
      <div className="mb-6">
        <label className="font-semibold block mb-2">
          Endpoint
        </label>

        <div className="flex gap-2">
          <input
            value={endpoint}
            readOnly
            className="w-full border p-2 rounded"
          />
          <button
            onClick={() => copy(endpoint)}
            className="bg-black text-white px-4 rounded"
          >
            Copiar
          </button>
        </div>
      </div>

      {/* Secret */}
      <div className="mb-6">
        <label className="font-semibold block mb-2">
          Secret
        </label>

        <div className="flex gap-2">
          <input
            value={secret}
            readOnly
            className="w-full border p-2 rounded"
          />
          <button
            onClick={() => copy(secret)}
            className="bg-black text-white px-4 rounded"
          >
            Copiar
          </button>
        </div>
      </div>

      {/* JSON */}
      <div className="mb-6">
        <label className="font-semibold block mb-2">
          Body JSON
        </label>

        <textarea
          value={example}
          readOnly
          className="w-full border p-3 rounded h-48"
        />

        <button
          onClick={() => copy(example)}
          className="mt-2 bg-black text-white px-4 py-2 rounded"
        >
          Copiar JSON
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-semibold mb-2">
          Como ligar no ManyChat
        </h2>

        <ol className="list-decimal ml-4 space-y-1 text-sm">
          <li>Open ManyChat</li>
          <li>Automation</li>
          <li>Add Action</li>
          <li>External Request</li>
          <li>POST</li>
          <li>Colar endpoint</li>
          <li>Colar JSON</li>
          <li>Salvar</li>
        </ol>
      </div>
    </div>
  );
}