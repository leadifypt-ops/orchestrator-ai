export async function sendWhatsappReply({
  phone,
  message,
}: {
  phone?: string | null;
  message: string;
}) {
  if (!process.env.WHATSAPP_API_URL) {
    console.log("WhatsApp not configured");
    return;
  }

  try {
    await fetch(process.env.WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
      },
      body: JSON.stringify({
        phone,
        text: message,
      }),
    });
  } catch (error) {
    console.error("WhatsApp reply error", error);
  }
}