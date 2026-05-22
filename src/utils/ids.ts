export const IDS = {
  TICKET_CATEGORY:       'ticket_category',
  TICKET_CLOSE:          'ticket_close',
  TICKET_CONFIRM_CLOSE:  'ticket_confirm_close',
  TICKET_CANCEL_CLOSE:   'ticket_cancel_close',
  TICKET_CLAIM:          'ticket_claim',
  TICKET_ADD_PROMPT:     'ticket_add_prompt',
  TICKET_REMOVE_PROMPT:  'ticket_remove_prompt',
  TICKET_ADD_MODAL:      'ticket_add_modal',
  TICKET_REMOVE_MODAL:   'ticket_remove_modal',
  TICKET_PRIORITY_PROMPT:    'ticket_priority_prompt',
  TICKET_PRIORITY:           'ticket_priority',
  TICKET_NOTE_PROMPT:        'ticket_note_prompt',
  TICKET_NOTE_MODAL:         'ticket_note',
  TICKET_CLOSE_REASON_MODAL: 'ticket_close_reason',
  ACCEPT_RULES:          'accept_rules',
} as const;

export function makeId(prefix: string, payload: string): string {
  return `${prefix}:${payload}`;
}

export function parseId(customId: string): { prefix: string; payload: string } {
  const idx = customId.indexOf(':');
  if (idx === -1) return { prefix: customId, payload: '' };
  return { prefix: customId.slice(0, idx), payload: customId.slice(idx + 1) };
}

export function sanitizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}
