import config from './config.js';

const { idInstance, token, baseUrl } = config.greenApi;

// Note the token position: it is the LAST path segment, after the method name.
// Putting it anywhere else returns a bare 403 with no explanation.
const url = (method) => `${baseUrl}/waInstance${idInstance}/${method}/${token}`;

export async function sendMessage(chatId, message) {
  const res = await fetch(url('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  });
  if (!res.ok) throw new Error(`Green API sendMessage ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getStateInstance() {
  const res = await fetch(url('getStateInstance'));
  if (!res.ok) throw new Error(`Green API getStateInstance ${res.status}`);
  return res.json();
}

/** Point the instance's webhook at this deployment. */
export async function setWebhook(webhookUrl) {
  const res = await fetch(url('setSettings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookUrl,
      webhookUrlToken: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'no',
      outgoingMessageWebhook: 'no',
      outgoingAPIMessageWebhook: 'no',
      stateWebhook: 'no',
      deviceWebhook: 'no',
      pollMessageWebhook: 'no',
    }),
  });
  if (!res.ok) throw new Error(`Green API setSettings ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Text lives under a different key depending on the message type. */
export function extractText(messageData) {
  if (!messageData) return null;
  switch (messageData.typeMessage) {
    case 'textMessage':
      return messageData.textMessageData?.textMessage || null;
    case 'extendedTextMessage':
    case 'quotedMessage':
      return messageData.extendedTextMessageData?.text || null;
    default:
      return null;
  }
}
