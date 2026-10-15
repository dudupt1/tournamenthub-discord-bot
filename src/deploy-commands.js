import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';
import { config, requireDeployConfig } from './config.js';

try {
  requireDeployConfig();
  const rest = new REST({ version: '10' }).setToken(config.token);
  console.log(`Registering ${commands.length} TournamentHub commands...`);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  console.log('Commands registered successfully.');
} catch (error) {
  console.error('Could not deploy commands:', error.message);
  process.exitCode = 1;
}
