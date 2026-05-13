import type { ModalSubmitInteraction } from 'discord.js';
import { upsertCategory, getAllCategories } from '../../services/guildConfigService';
import {
  createManageCategoriesEmbed, buildManageCategoriesComponents,
} from '../../services/embedService';
import { isAdmin } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import type { ModalHandler } from '../../types';

export const setupAddCategoryModal: ModalHandler = {
  prefix: 'setup',

  async execute(interaction: ModalSubmitInteraction, payload: string) {
    if (payload !== 'cat:add') return;
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const guildId = interaction.guildId;
    const key = interaction.fields.getTextInputValue('key').toLowerCase().replace(/\s+/g, '-');
    const label = interaction.fields.getTextInputValue('label');
    const description = interaction.fields.getTextInputValue('description');
    const emoji = interaction.fields.getTextInputValue('emoji');

    const existing = getAllCategories(guildId);
    const sortOrder = existing.length;

    upsertCategory(guildId, {
      guild_id: guildId,
      key,
      label,
      description,
      emoji,
      sort_order: sortOrder,
      enabled: 1,
    });

    const categories = getAllCategories(guildId);
    await interaction.reply({ ephemeral: true,
      embeds: [createManageCategoriesEmbed(categories)],
      components: buildManageCategoriesComponents(categories),
    });
  },
};
