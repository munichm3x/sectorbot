// src/features/streamer/streamer.interactions.ts
import type { BootstrapContext } from '../../bootstrap/context';
import {
  handleWizardButton, handleWizardRoleSelect,
  handleWizardChannelSelect, handleWizardModal,
} from './streamer.wizard';
import {
  handleDashboardButton, handleDashboardRoleSelect,
  handleDashboardChannelSelect, handleDashboardStringSelect,
  handleDashboardUserSelect, handleDashboardModal,
} from './streamer.dashboard';

export function registerStreamerInteractions(ctx: BootstrapContext): void {
  ctx.buttonHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      if (payload.startsWith('wizard:')) {
        return handleWizardButton(interaction, payload);
      }
      return handleDashboardButton(interaction, payload, ctx.client);
    },
  });

  ctx.selectMenuHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      return handleDashboardStringSelect(interaction, payload);
    },
  });

  ctx.roleSelectHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      if (payload.startsWith('wizard:role')) {
        return handleWizardRoleSelect(interaction, payload);
      }
      return handleDashboardRoleSelect(interaction, payload);
    },
  });

  ctx.channelSelectHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      if (payload.startsWith('wizard:channel')) {
        return handleWizardChannelSelect(interaction, payload);
      }
      return handleDashboardChannelSelect(interaction, payload);
    },
  });

  ctx.modalHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      if (payload.includes('_wizard')) {
        return handleWizardModal(interaction, payload);
      }
      return handleDashboardModal(interaction, payload, ctx.client);
    },
  });

  ctx.userSelectHandlers.set('str', {
    prefix: 'str',
    async execute(interaction, payload) {
      return handleDashboardUserSelect(interaction, payload);
    },
  });
}
