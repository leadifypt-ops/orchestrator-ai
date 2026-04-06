export async function sendInstagramReply({
  instagram,
  message,
}: {
  instagram?: string | null;
  message: string;
}) {
  if (!process.env.MANYCHAT_API_URL) {
    console.log("ManyChat not configured");
    return;
  }

  try {
    await fetch(process.env.MANYCHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MANYCHAT_API_KEY}`,
      },
      body: JSON.stringify({
        instagram,
        text: message,
      }),
    });
  } catch (error) {
    console.error("Instagram reply error", error);
  }
}