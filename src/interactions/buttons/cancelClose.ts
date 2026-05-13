import type { ButtonInteraction } from 'discord.js';
import { IDS } from '../../utils/ids';
import type { ButtonHandler } from '../../types';

export const ticketCancelCloseHandler: ButtonHandler = {
  prefix: IDS.TICKET_CANCEL_CLOSE,

  async execute(interaction: ButtonInteraction, _payload: string) {
    await interaction.update({ content: '↩️ Abgebrochen.', embeds: [], components: [] });
  },
};
