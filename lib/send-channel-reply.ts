import { sendInstagramReply } from "./send-instagram-reply";
import { sendWhatsappReply } from "./send-whatsapp-reply";

type SendReplyInput = {
  channel?: string | null;
  instagram?: string | null;
  phone?: string | null;
  message: string;
};

export async function sendChannelReply({
  channel,
  instagram,
  phone,
  message,
}: SendReplyInput) {
  if (!channel) return;

  if (channel === "instagram") {
    await sendInstagramReply({
      instagram,
      message,
    });
  }

  if (channel === "whatsapp") {
    await sendWhatsappReply({
      phone,
      message,
    });
  }
}