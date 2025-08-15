const AfricasTalking = require('africastalking');

// Initialize AfricasTalking
const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY || 'atsk_028f6176262c4ce1528ee1aa0a069c486f2727e760914262e5c4cb8f65b6ca341bba9606',
  username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
});

const sms = africastalking.SMS;

const sendSMS = async (to, message) => {
  try {
    const response = await sms.send({
      to: to,
      message: message,
      from: process.env.AFRICASTALKING_SENDER_ID || 'PAYGO', // Optional: Your custom sender ID
    });
    console.log('SMS sent successfully:', response);
    return response;
  } catch (error) {
    // console.error('Error sending SMS:', error);
    throw error;
  }
};

const sendWhatsAppMessage = async (to, message) => {
  // This is a placeholder. Full WhatsApp Business API integration is complex.
  // You would typically use a WhatsApp Business API provider (e.g., Twilio, MessageBird, or direct Meta API).
  // This would involve setting up webhooks, templates, and handling message delivery.
  console.warn('WhatsApp integration is a placeholder. Implement actual WhatsApp Business API logic here.');
  console.log(`Simulating WhatsApp message to ${to}: ${message}`);
  return { status: 'success', message: 'WhatsApp message simulated' };
};

module.exports = {
  sendSMS,
  sendWhatsAppMessage,
};
