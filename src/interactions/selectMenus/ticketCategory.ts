import { EmbedBuilder } from 'discord.js';
import type { StringSelectMenuInteraction } from 'discord.js';
import { findOpenTicketByUser } from '../../db/index';
import { getConfig } from '../../services/guildConfigService';
import { openTicket, TicketError, type TicketErrorCode } from '../../services/ticketService';
import { startAutoCloseTimer } from '../../features/ticketAutoClose';
import { IDS } from '../../utils/ids';
import { logger } from '../../utils/logger';
import { SECTOR_COLORS } from '../../ui/brand';
import type { SelectMenuHandler } from '../../types';

export const ticketCategoryHandler: SelectMenuHandler = {
  prefix: IDS.TICKET_CATEGORY,

  async execute(interaction: StringSelectMenuInteraction, _payload: string) {
    if (!interaction.inCachedGuild()) return;

    const categoryKey = interaction.values[0];
    if (!categoryKey) return;

    await interaction.deferReply({ ephemeral: true });

    const existing = findOpenTicketByUser(interaction.guild.id, interaction.member.id);
    if (existing) {
      await interaction.editReply({
        content: `❌ Du hast bereits ein offenes Ticket: <#${existing.channel_id}>\nBitte schließe es zuerst.`,
      });
      return;
    }

    try {
      const { channelId, welcomeFailed } = await openTicket(interaction.guild, interaction.member, categoryKey);
      startAutoCloseTimer(channelId);
      if (welcomeFailed) {
        await interaction.editReply({
          content: `✅ Dein Ticket wurde erstellt: <#${channelId}>\n⚠️ Die Startnachricht konnte nicht gesendet werden. Das Team wurde informiert.`,
        });
      } else {
        await interaction.editReply({ content: `✅ Dein Ticket wurde erstellt: <#${channelId}>` });
      }
    } catch (err) {
      // ─── Full admin diagnosis in console ─────────────────────────────────
      logger.error('Ticket-Erstellung fehlgeschlagen', {
        guildId:     interaction.guild.id,
        userId:      interaction.member.id,
        categoryKey,
        errorCode:   err instanceof TicketError ? err.code : 'UNKNOWN_ERROR',
        error:       err,
      });

      // ─── User-facing message ──────────────────────────────────────────────
      const userMsg = err instanceof TicketError
        ? err.message
        : 'Das Ticket konnte nicht erstellt werden. Ein Admin wurde informiert.';

      await interaction.editReply({ content: `❌ ${userMsg}` });

      // ─── Admin log-channel embed ──────────────────────────────────────────
      try {
        const config = getConfig(interaction.guild.id);
        if (config?.ticket_log_channel_id) {
          const logChannel = await interaction.guild.channels
            .fetch(config.ticket_log_channel_id)
            .catch(() => null);
          if (logChannel?.isTextBased()) {
            const errorCode: TicketErrorCode = err instanceof TicketError ? err.code : 'UNKNOWN_ERROR';
            const technical = err instanceof Error
              ? err.message.slice(0, 300)
              : String(err).slice(0, 300);
            const embed = new EmbedBuilder()
              .setColor(SECTOR_COLORS.BLOOD_RED)
              .setTitle('⚠ Ticket-Erstellung fehlgeschlagen')
              .addFields(
                { name: 'User',               value: `<@${interaction.member.id}>`, inline: true },
                { name: 'Kategorie',          value: categoryKey,                   inline: true },
                { name: 'Ursache',            value: errorCode,                     inline: true },
                { name: 'Lösung',             value: getSolutionHint(errorCode),    inline: false },
                { name: 'Technische Details', value: `\`\`\`\n${technical}\n\`\`\``, inline: false },
              )
              .setTimestamp();
            await logChannel.send({ embeds: [embed] });
          }
        }
      } catch {
        // Never let log-channel errors propagate
      }
    }
  },
};

function getSolutionHint(code: TicketErrorCode): string {
  switch (code) {
    case 'MISSING_SUPPORT_ROLES':
      return 'Öffne /setup → Ticket-System → Support-Rollen und wähle mindestens eine Rolle aus.';
    case 'MISSING_BOT_PERMISSIONS':
      return 'Gib der Bot-Rolle die Berechtigung „Kanäle verwalten" (ManageChannels) auf Server-Ebene.';
    case 'INVALID_CATEGORY':
      return 'Veröffentliche das Ticket-Panel erneut über /setup → Ticket-System → Panel veröffentlichen.';
    case 'CHANNEL_CREATE_FAILED':
      return 'Prüfe Bot-Berechtigungen (ManageChannels, ViewChannel) und ob das Channel-Limit (500) erreicht wurde.';
    case 'DB_WRITE_FAILED':
      return 'Datenbankfehler. Überprüfe die Datenbankdatei und Schreibrechte des Prozesses.';
    default:
      return 'Unbekannter Fehler. Prüfe die Bot-Konsole für weitere Details.';
  }
}
