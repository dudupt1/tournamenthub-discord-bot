import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config, requireRuntimeConfig } from './config.js';
import { handleTournamentButton, handleTournamentCommand, isTournamentButton } from './features/tournaments.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function failGracefully(interaction) {
  const message = 'TournamentHub could not finish that action. Please try again.';
  if (interaction.deferred) await interaction.editReply({ content: message }).catch(() => null);
  else if (interaction.replied) await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
  else await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`TournamentHub is online as ${readyClient.user.tag}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.inGuild()) {
      if (interaction.isRepliable()) await interaction.reply({ content: 'TournamentHub can only be used in Discord servers.', ephemeral: true });
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'tournament') {
      await handleTournamentCommand(interaction);
      return;
    }

    if (interaction.isButton() && isTournamentButton(interaction)) {
      await handleTournamentButton(interaction);
    }
  } catch (error) {
    console.error('Interaction error:', error);
    await failGracefully(interaction);
  }
});

try {
  requireRuntimeConfig();
  client.login(config.token);
} catch (error) {
  console.error(`TournamentHub could not start: ${error.message}`);
  process.exitCode = 1;
}
