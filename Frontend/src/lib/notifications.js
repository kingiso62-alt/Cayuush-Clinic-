import { supabase } from './supabase';

/**
 * Mock Notification Service
 * In a real-world scenario, you would connect this to Hormuud API, Twilio, or WhatsApp Business API.
 */

export const sendNotification = async ({ type, phone, message }) => {
  console.log(`[NOTIFICATION SERVICE] Sending ${type} to ${phone}:`);
  console.log(`"${message}"`);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  // If you wanted to save notifications to the database for history:
  // await supabase.from('notifications_log').insert({ type, phone, message });

  return { success: true, message: 'Notification sent successfully' };
};

export const sendSMS = async (phone, message) => {
  return sendNotification({ type: 'SMS', phone, message });
};

export const sendWhatsApp = async (phone, message) => {
  return sendNotification({ type: 'WhatsApp', phone, message });
};
