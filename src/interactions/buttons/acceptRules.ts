import type { ButtonInteraction } from 'discord.js';
import { assignWhitelistRole } from '../../services/roleService';
import { createSuccessEmbed, createErrorEmbed } from '../../services/embedService';
import { logger } from '../../utils/logger';
import { IDS } from '../../utils/ids';
import type { ButtonHandler } from '../../types';

export const acceptRulesHandler: ButtonHandler = {
  prefix: IDS.ACCEPT_RULES,

  async execute(interaction: ButtonInteraction, _payload: string) {
    if (!interaction.inCachedGuild()) return;

    try {
      const result = await assignWhitelistRole(interaction.member);

      if (result === 'already_has') {
        return interaction.reply({
          embeds: [createSuccessEmbed('Du bist bereits freigeschaltet.')],
          ephemeral: true,
        });
      }

      await interaction.reply({
        embeds: [createSuccessEmbed('Regeln akzeptiert. Du wurdest freigeschaltet.')],
        ephemeral: true,
      });
    } catch (err: unknown) {
      logger.error('Whitelist-Rolle konnte nicht vergeben werden', err);
      await interaction.reply({
        embeds: [createErrorEmbed('Die Freischaltung konnte nicht abgeschlossen werden. Bitte wende dich an das Team.')],
        ephemeral: true,
      });
    }
  },
};
