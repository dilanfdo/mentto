// Message templates for fee reminders and receipts. Everyone gets the defaults; Pro lets the tutor
// write their own. Placeholders in {curly braces} are filled in when a message is sent.

export const PLACEHOLDERS = {
  feeReminder: ['{name}', '{amount}', '{due}', '{tutor}'],
  receipt: ['{name}', '{amount}', '{date}', '{method}', '{tutor}'],
} as const;

export const DEFAULT_TEMPLATES = {
  feeReminder: 'Hi {name}, a friendly reminder that the lesson fee of {amount} {due}. Thank you!\n– {tutor}',
  receipt: 'Payment received – thank you!\n\nStudent: {name}\nAmount: {amount}\nDate: {date}\nMethod: {method}\n\n– {tutor}',
};

export type TemplateKind = keyof typeof DEFAULT_TEMPLATES;

/** Fills in placeholders. Lines left with an empty "– {tutor}" sign-off are dropped. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match))
    .split('\n')
    .filter((line) => line.trim() !== '–')
    .join('\n')
    .trim();
}
