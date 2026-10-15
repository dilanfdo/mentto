import { Alert, Linking, Share } from 'react-native';

const digits = (phone: string) => phone.replace(/[^\d+]/g, '');

async function open(url: string, fallbackMessage: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Couldn’t open', fallbackMessage);
  }
}

export function callPhone(phone: string) {
  return open(`tel:${digits(phone)}`, 'This phone can’t make calls.');
}

export function sendSms(phone: string, body?: string) {
  const query = body ? `?body=${encodeURIComponent(body)}` : '';
  return open(`sms:${digits(phone)}${query}`, 'No messaging app was found.');
}

export function sendEmail(email: string) {
  return open(`mailto:${email}`, 'No email app was found.');
}

/** Opens the share sheet so the tutor can send through WhatsApp, SMS or anything else. */
export async function shareText(message: string) {
  try {
    await Share.share({ message });
  } catch {
    // Dismissed or unavailable; nothing to do.
  }
}
