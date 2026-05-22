import {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  type ButtonInteraction, type ModalSubmitInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../../db/index';
import { canModerateTicket } from '../../services/permissionService';
import { addNote } from '../../services/ticketNotesService';
import { replyError } from '../../utils/errors';
import { IDS, makeId } from '../../utils/ids';
import type { ButtonHandler, ModalHandler } from '../../types';

export const ticketNotePromptHandler: ButtonHandler = {
  prefix: IDS.TICKET_NOTE_PROMPT,

  async execute(interaction: ButtonInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Nur Support-Mitglieder können Notizen hinzufügen.');
    }

    const modal = new ModalBuilder()
      .setCustomId(makeId(IDS.TICKET_NOTE_MODAL, channelId))
      .setTitle('Interne Notiz hinzufügen')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('note_content')
            .setLabel('Notiz (intern — nur für Support sichtbar)')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
  },
};

export const ticketNoteModalHandler: ModalHandler = {
  prefix: IDS.TICKET_NOTE_MODAL,

  async execute(interaction: ModalSubmitInteraction, channelId: string) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(channelId);
    if (!ticket) return replyError(interaction, 'Ticket nicht gefunden.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) {
      return replyError(interaction, 'Keine Berechtigung.');
    }

    const content = interaction.fields.getTextInputValue('note_content');

    try {
      await addNote(
        ticket.id,
        interaction.guildId,
        interaction.member.id,
        interaction.member.user.username,
        content,
      );
      await interaction.reply({
        content: '✅ Notiz wurde intern gespeichert.',
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({
        content: `❌ Fehler beim Speichern der Notiz: ${err instanceof Error ? err.message : String(err)}`,
        ephemeral: true,
      });
    }
  },
};
