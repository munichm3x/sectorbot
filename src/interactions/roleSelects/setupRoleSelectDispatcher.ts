import type { RoleSelectMenuInteraction } from 'discord.js';
import { getConfig, upsertConfig, getSupportRoles, setSupportRoles } from '../../services/guildConfigService';
import {
  createWizardStep3Embed, buildWizardStep3Components,
  createWizardStep6Embed, buildWizardStep6Components,
} from '../../services/embedService';
import { isAdmin } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import type { RoleSelectMenuHandler } from '../../types';

export const setupRoleSelectDispatcher: RoleSelectMenuHandler = {
  prefix: 's',

  async execute(interaction: RoleSelectMenuInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const { guild } = interaction;
    const guildId   = guild.id;

    // Step 3 – Support-Rollen
    if (payload === 't:supp') {
      setSupportRoles(guildId, interaction.values);
      const supportRoles = getSupportRoles(guildId);
      return interaction.update({
        embeds: [createWizardStep3Embed(supportRoles)],
        components: buildWizardStep3Components(),
      });
    }

    // Step 6 – Whitelist-Rolle
    if (payload === 'r:role') {
      const roleId = interaction.values[0];
      if (!roleId) return;
      upsertConfig(guildId, { whitelist_role_id: roleId });
      const config = getConfig(guildId)!;
      return interaction.update({
        embeds: [createWizardStep6Embed(config, guild)],
        components: buildWizardStep6Components(),
      });
    }
  },
};
