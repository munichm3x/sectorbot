// src/bootstrap/registerInteractions.ts
import type { BootstrapContext } from './context';

// Button imports (11 named)
import { changelogButtonHandler }     from '../interactions/buttons/changelogButtonHandler';
import { scumStatusSetupHandler }     from '../interactions/buttons/setup/scumStatusSetupHandler';
import { ticketCloseHandler }         from '../interactions/buttons/closeTicket';
import { ticketConfirmCloseHandler }  from '../interactions/buttons/confirmClose';
import { ticketCancelCloseHandler }   from '../interactions/buttons/cancelClose';
import { ticketClaimHandler }         from '../interactions/buttons/claimTicket';
import { ticketAddPromptHandler }     from '../interactions/buttons/addUserPrompt';
import { ticketRemovePromptHandler }  from '../interactions/buttons/removeUserPrompt';
import { acceptRulesHandler }         from '../interactions/buttons/acceptRules';
import { setupButtonDispatcher }      from '../interactions/buttons/setup/setupDispatcher';
import { ticketArchivButtonHandler }  from '../interactions/buttons/ticketArchivHandler';

// Select menu imports (2 named)
import { ticketCategoryHandler }      from '../interactions/selectMenus/ticketCategory';
import { ticketArchivSelectHandler }  from '../interactions/selectMenus/ticketArchivSelectHandler';

// Channel select imports (1 named)
import { setupChannelSelectDispatcher } from '../interactions/channelSelects/setupChannelSelectDispatcher';

// Role select imports (1 named)
import { setupRoleSelectDispatcher }  from '../interactions/roleSelects/setupRoleSelectDispatcher';

// Modal imports (6 named)
import { ticketAddModalHandler }      from '../interactions/modals/ticketAddModal';
import { ticketRemoveModalHandler }   from '../interactions/modals/ticketRemoveModal';
import { setupAddCategoryModal }      from '../interactions/modals/setupAddCategoryModal';
import { changelogModalHandler }      from '../interactions/modals/changelogModalHandler';
import { scumStatusModalHandler }     from '../interactions/modals/scumStatusModals';
import { ticketArchivModalHandler }   from '../interactions/modals/ticketArchivModalHandler';
import { ticketCloseReasonModalHandler } from '../interactions/modals/ticketCloseReasonModal';
import { ticketNotePromptHandler, ticketNoteModalHandler } from '../interactions/modals/ticketNoteModal';
import { ticketPriorityPromptHandler, ticketPrioritySelectHandler } from '../interactions/selectMenus/ticketPrioritySelect';

// Streamer interactions (registers 'str' prefix in all maps)
import { registerStreamerInteractions } from '../features/streamer/streamer.interactions';

export function registerInteractions(ctx: BootstrapContext): void {
  // Buttons (11 named handlers)
  for (const handler of [
    ticketCloseHandler, ticketConfirmCloseHandler, ticketCancelCloseHandler,
    ticketClaimHandler, ticketAddPromptHandler, ticketRemovePromptHandler,
    acceptRulesHandler, setupButtonDispatcher, changelogButtonHandler,
    scumStatusSetupHandler, ticketArchivButtonHandler,
    ticketPriorityPromptHandler, ticketNotePromptHandler,
  ]) {
    ctx.buttonHandlers.set(handler.prefix, handler);
  }

  // String select menus (2 named handlers)
  ctx.selectMenuHandlers.set(ticketCategoryHandler.prefix, ticketCategoryHandler);
  ctx.selectMenuHandlers.set(ticketArchivSelectHandler.prefix, ticketArchivSelectHandler);
  ctx.selectMenuHandlers.set(ticketPrioritySelectHandler.prefix, ticketPrioritySelectHandler);

  // Channel selects (1 named handler)
  ctx.channelSelectHandlers.set(setupChannelSelectDispatcher.prefix, setupChannelSelectDispatcher);

  // Role selects (1 named handler)
  ctx.roleSelectHandlers.set(setupRoleSelectDispatcher.prefix, setupRoleSelectDispatcher);

  // Modals (8 named handlers)
  for (const handler of [
    ticketAddModalHandler, ticketRemoveModalHandler, setupAddCategoryModal,
    changelogModalHandler, scumStatusModalHandler, ticketArchivModalHandler,
    ticketCloseReasonModalHandler, ticketNoteModalHandler,
  ]) {
    ctx.modalHandlers.set(handler.prefix, handler);
  }

  // Streamer ('str' prefix in all interaction maps)
  registerStreamerInteractions(ctx);

  ctx.logger.info(
    `[bootstrap] Interactions registriert — Buttons: ${ctx.buttonHandlers.size}, Modals: ${ctx.modalHandlers.size}`,
  );
}
