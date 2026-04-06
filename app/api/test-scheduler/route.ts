import { NextResponse } from "next/server";

export async function GET() {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const schedulerSecret = process.env.SCHEDULER_SECRET;

    if (!appUrl || !schedulerSecret) {
      return NextResponse.json(
        { error: "Variáveis de ambiente em falta." },
        { status: 500 }
      );
    }

    const response = await fetch(`${appUrl}/api/scheduler`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${schedulerSecret}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao testar scheduler." },
      { status: 500 }
    );
  }
}