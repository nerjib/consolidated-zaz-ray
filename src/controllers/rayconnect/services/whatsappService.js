
const axios = require('axios');

const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

const sendWhatsAppTemplateMessage = async (to, templateName, components, code) => {
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

  const data = {
    messaging_product: 'whatsapp',
    to: `234${to.slice(-10)}`,
    type: 'template',
    template: {
      name: templateName,
      language: { code },
      components: components,
    },
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.post(url, data, { headers: headers });
    console.log('WhatsApp template message sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp template message:', error.response ? error.response.data : error.message);
    if (error.response) {
      console.error('Axios Error Data:', error.response.data);
    }
    throw error;
  }
};

const sendAgentCreationMessage = async (to, agentName, businessName) => {
  const templateName = 'account_creation';
  const components = [
    {
      type: 'header',
      parameters: [
        {
          type: 'text',
          text: businessName,
        },
      ],
    },
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: agentName,
        },
      ],
    },
  ];
  return sendWhatsAppTemplateMessage(to, templateName, components, 'en');
};

const sendPaymentDoneMessage = async (to, name, amount, deviceid, token, days, company) => {
  const templateName = 'token_payment';
  const components = [
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: name,
        },
        {
          type: 'text',
          text: amount,
        },
        {
          type: 'text',
          text: deviceid,
        },
        {
          type: 'text',
          text: token,
        },
        {
          type: 'text',
          text: days,
        },
        {
          type: 'text',
          text: company,
        },
      ],
    },
  ];
  return sendWhatsAppTemplateMessage(to, templateName, components, 'en');
};

const sendPaymentReceiptMessage = async (to, name, amount, cycle_amount, company) => {
  const templateName = 'non_token_payment';
  const components = [
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: name,
        },
        {
          type: 'text',
          text: amount,
        },
        {
          type: 'text',
          text: cycle_amount,
        },
        {
          type: 'text',
          text: company,
        },
      ],
    },
  ];
  return sendWhatsAppTemplateMessage(to, templateName, components, 'en');
};

const sendVirtualAccountCreationLoanMessage = async (to, name, account_number, bank, account_name, business_name) => {
  const templateName = 'virtual_account';
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: account_number },
        { type: 'text', text: bank },
        { type: 'text', text: account_name },
        { type: 'text', text: business_name },
      ],
    },
    {
      type: "header",
      parameters: [{type:"text", text: business_name}]
    }
  ];
  return sendWhatsAppTemplateMessage(to, templateName, components, 'en_US');
};

const sendAgentCreditTopUpMessage = async (to, name, account_number, bank, account_name, business_name) => {
  const templateName = 'pay_account';
  console.log({to, name, account_number, bank, account_name, business_name})
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: name },
        { type: 'text', text: account_name },
        { type: 'text', text: account_number },
        { type: 'text', text: bank },
        { type: 'text', text: business_name },
      ],
    },
  ];
  return sendWhatsAppTemplateMessage(to, templateName, components, 'en');
};

module.exports = {
  sendAgentCreationMessage,
  sendPaymentDoneMessage,
  sendPaymentReceiptMessage,
  sendVirtualAccountCreationLoanMessage,
  sendAgentCreditTopUpMessage,
};
