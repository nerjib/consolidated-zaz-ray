const AfricasTalking = require('africastalking');

const sendSMS = async (to, message, credentials) => {
  if (!credentials || !credentials.africastalking_api_key || !credentials.africastalking_username) {
    console.error('SMS service is not configured for this business.');
    // Silently fail or throw an error, depending on desired behavior.
    // For now, we'll log and return to avoid halting the payment process.
    return;
  }

  const africastalking = AfricasTalking({
    apiKey: credentials.africastalking_api_key,
    username: credentials.africastalking_username,
  });

  const sms = africastalking.SMS;

  try {
    const response = await sms.send({
      to: to,
      message: message,
      from: process.env.AFRICASTALKING_SENDER_ID || 'PAYGO', // This could also be made a per-business setting
    });
    console.log('SMS sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending SMS:', error.toString());
    // Do not re-throw the error to prevent halting the entire payment flow
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
