import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

const tournamentId = (option) => option.setName('id').setDescription('Tournament ID shown by /tournament list.').setMinLength(8).setMaxLength(8).setRequired(true);

export const commands = [
  new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Create and manage single-elimination tournaments.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Open registrations for a tournament.')
        .addStringOption((option) => option.setName('name').setDescription('Tournament title.').setMinLength(3).setMaxLength(80).setRequired(true))
        .addStringOption((option) => option.setName('game').setDescription('Game or activity being played.').setMinLength(2).setMaxLength(60).setRequired(true))
        .addIntegerOption((option) => option.setName('teams').setDescription('Number of teams: 2, 4 or 8.').addChoices({ name: '2 teams', value: 2 }, { name: '4 teams', value: 4 }, { name: '8 teams', value: 8 }).setRequired(true))
        .addIntegerOption((option) => option.setName('team-size').setDescription('Players per team.').setMinValue(1).setMaxValue(5).setRequired(true)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Show current tournaments.'))
    .addSubcommand((subcommand) => subcommand.setName('teams').setDescription('Randomly form teams after registrations fill.').addStringOption(tournamentId))
    .addSubcommand((subcommand) => subcommand.setName('bracket').setDescription('Show the live elimination bracket.').addStringOption(tournamentId))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('result')
        .setDescription('Report a match winner and advance the bracket.')
        .addStringOption(tournamentId)
        .addStringOption((option) => option.setName('match').setDescription('Match code, for example R1-M1.').setMinLength(5).setMaxLength(8).setRequired(true))
        .addStringOption((option) => option.setName('winner').setDescription('Winning team code, for example T1.').setMinLength(2).setMaxLength(4).setRequired(true)),
    )
    .addSubcommand((subcommand) => subcommand.setName('cancel').setDescription('Cancel a tournament.').addStringOption(tournamentId)),
].map((command) => command.toJSON());

export const managementPermission = PermissionFlagsBits.ManageGuild;
