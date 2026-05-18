import {
  EmbedBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { SECTOR_COLORS } from '../../ui/brand';
import type { QueryResult } from './scumStatus.service';

const STATUS_TITLE  = '🖥️ Sector 13';
const STATUS_FOOTER = 'Automatisches Server-Dashboard';

export function buildStatusEmbed(result: QueryResult): EmbedBuilder {
  const now = Math.floor(Date.now() / 1000);

  if (!result.online) {
    return new EmbedBuilder()
      .setColor(SECTOR_COLORS.OFFLINE_RED)
      .setTitle(STATUS_TITLE)
      .setDescription('🔴 Offline')
      .addFields(
        { name: '👥 Spieler',               value: 'Nicht verfügbar', inline: true  },
        { name: '🏓 Ping',                  value: 'Nicht verfügbar', inline: true  },
        { name: '🕐 Letzte Aktualisierung', value: `<t:${now}:R>`,   inline: false },
      )
      .setFooter({ text: STATUS_FOOTER })
      .setTimestamp();
  }

  const descriptionLines = ['🟢 Online'];
  if (result.serverName) descriptionLines.push(`\`${result.serverName}\``);

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.ONLINE_GREEN)
    .setTitle(STATUS_TITLE)
    .setDescription(descriptionLines.join('\n'))
    .addFields(
      { name: '👥 Spieler',               value: `${result.players} / ${result.maxPlayers}`, inline: true  },
      { name: '🏓 Ping',                  value: `${result.ping} ms`,                        inline: true  },
      { name: '🕐 Letzte Aktualisierung', value: `<t:${now}:R>`,                             inline: false },
    )
    .setFooter({ text: STATUS_FOOTER })
    .setTimestamp();
}

export function buildScumConfigModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('scum_status:config')
    .setTitle('Server konfigurieren')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('host')
          .setLabel('Server-IP oder Domain')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('z.B. 123.456.789.0'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('query_port')
          .setLabel('Query-Port')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Standard: 27015'),
      ),
    );
}

export function buildScumIntervalModal(currentSecs: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('scum_status:interval')
    .setTitle('Aktualisierungsintervall')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('interval_secs')
          .setLabel('Intervall in Sekunden (Minimum: 30)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('z.B. 60')
          .setValue(String(currentSecs)),
      ),
    );
}
