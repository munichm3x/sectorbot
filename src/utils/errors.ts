import { EmbedBuilder } from 'discord.js';
import type {
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
  UserSelectMenuInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { SECTOR_COLORS } from '../ui/brand';

type RepliableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction
  | RoleSelectMenuInteraction
  | UserSelectMenuInteraction
  | ModalSubmitInteraction;

export async function replyError(interaction: RepliableInteraction, message: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.BLOOD_RED)
    .setTitle('❌ Fehler')
    .setDescription(message);

  const payload = { embeds: [embed], ephemeral: true } as const;

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

export class BotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotError';
  }
}
