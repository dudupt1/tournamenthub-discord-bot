import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { mutate, snapshot } from '../storage.js';

const PREFIX = 'tournamenthub';
const teamNames = ['Alpha', 'Bravo', 'Comet', 'Drift', 'Echo', 'Falcon', 'Glacier', 'Horizon'];
const statusConfig = {
  registering: { label: 'Registrations open', emoji: '🟢', color: 0x57f287 },
  active: { label: 'Bracket live', emoji: '🏆', color: 0x5865f2 },
  complete: { label: 'Tournament complete', emoji: '👑', color: 0xfee75c },
  cancelled: { label: 'Cancelled', emoji: '⛔', color: 0xed4245 },
};

function tournamentId() {
  return randomUUID().split('-')[0];
}

function tournamentsFor(data, guildId) {
  return data.tournaments[guildId] ?? {};
}

function canManage(interaction, tournament) {
  return tournament.createdBy === interaction.user.id || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

/** Builds empty future rounds so match winners can progress automatically. */
export function buildBracket(teams) {
  const rounds = [];
  let matchesInRound = teams.length / 2;
  let roundNumber = 1;

  while (matchesInRound >= 1) {
    const round = [];
    for (let matchNumber = 1; matchNumber <= matchesInRound; matchNumber += 1) {
      const index = (matchNumber - 1) * 2;
      round.push({
        id: `R${roundNumber}-M${matchNumber}`,
        teamA: roundNumber === 1 ? teams[index]?.id ?? null : null,
        teamB: roundNumber === 1 ? teams[index + 1]?.id ?? null : null,
        winner: null,
      });
    }
    rounds.push(round);
    matchesInRound /= 2;
    roundNumber += 1;
  }

  return rounds;
}

/** Reports a winner and places that team into the appropriate next-round slot. */
export function reportWinner(tournament, matchId, winnerId) {
  const roundIndex = tournament.rounds.findIndex((round) => round.some((match) => match.id.toLowerCase() === matchId.toLowerCase()));
  if (roundIndex === -1) return { ok: false, reason: 'match-not-found' };

  const match = tournament.rounds[roundIndex].find((entry) => entry.id.toLowerCase() === matchId.toLowerCase());
  if (!match.teamA || !match.teamB) return { ok: false, reason: 'match-not-ready' };
  if (match.winner) return { ok: false, reason: 'match-finished' };
  if (winnerId !== match.teamA && winnerId !== match.teamB) return { ok: false, reason: 'invalid-winner' };

  match.winner = winnerId;
  const nextRound = tournament.rounds[roundIndex + 1];
  if (!nextRound) {
    tournament.champion = winnerId;
    tournament.status = 'complete';
    return { ok: true, champion: true, match };
  }

  const matchIndex = tournament.rounds[roundIndex].indexOf(match);
  const nextMatch = nextRound[Math.floor(matchIndex / 2)];
  if (matchIndex % 2 === 0) nextMatch.teamA = winnerId;
  else nextMatch.teamB = winnerId;

  return { ok: true, champion: false, match, nextMatch };
}

function formatTeam(tournament, teamId) {
  const team = tournament.teams?.find((entry) => entry.id === teamId);
  return team ? `${team.id} • ${team.name}` : 'TBD';
}

function tournamentEmbed(tournament) {
  const status = statusConfig[tournament.status] ?? statusConfig.registering;
  const fields = [
    { name: 'Game', value: tournament.game, inline: true },
    { name: 'Format', value: `${tournament.teamCount} teams • ${tournament.teamSize} player${tournament.teamSize === 1 ? '' : 's'} each`, inline: true },
    { name: 'Registered', value: `${tournament.registrants.length}/${tournament.capacity}`, inline: true },
    { name: 'Status', value: `${status.emoji} ${status.label}`, inline: true },
    { name: 'Host', value: `<@${tournament.createdBy}>`, inline: true },
  ];

  if (tournament.champion) fields.push({ name: 'Champion', value: `🏆 ${formatTeam(tournament, tournament.champion)}`, inline: false });

  return new EmbedBuilder()
    .setColor(status.color)
    .setTitle(tournament.name)
    .setDescription('Join below while registrations are open. When full, the host can use `/tournament teams` to generate teams and the bracket.')
    .addFields(fields)
    .setFooter({ text: `Tournament ID: ${tournament.id}` })
    .setTimestamp(new Date(tournament.createdAt));
}

function registrationControls(tournament) {
  const canJoin = tournament.status === 'registering' && tournament.registrants.length < tournament.capacity;
  const canLeave = tournament.status === 'registering';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${PREFIX}:join:${tournament.id}`).setLabel('Join tournament').setEmoji('🎮').setStyle(ButtonStyle.Success).setDisabled(!canJoin),
      new ButtonBuilder().setCustomId(`${PREFIX}:leave:${tournament.id}`).setLabel('Leave').setEmoji('↩️').setStyle(ButtonStyle.Secondary).setDisabled(!canLeave),
    ),
  ];
}

async function resolveTournamentChannel(guild, fallback) {
  if (!config.tournamentChannelId) return fallback;
  const channel = await guild.channels.fetch(config.tournamentChannelId).catch(() => null);
  return channel?.isTextBased() ? channel : fallback;
}

async function syncCard(guild, tournament) {
  const channel = await guild.channels.fetch(tournament.channelId).catch(() => null);
  if (!channel?.isTextBased()) return false;
  const message = await channel.messages.fetch(tournament.messageId).catch(() => null);
  if (!message) return false;
  await message.edit({ embeds: [tournamentEmbed(tournament)], components: registrationControls(tournament) });
  return true;
}

function formatBracket(tournament) {
  return tournament.rounds
    .map((round, index) => {
      const label = index === tournament.rounds.length - 1 ? 'Final' : `Round ${index + 1}`;
      const matches = round
        .map((match) => {
          const winner = match.winner ? ` → **${formatTeam(tournament, match.winner)}**` : '';
          return `\`${match.id}\` ${formatTeam(tournament, match.teamA)} vs ${formatTeam(tournament, match.teamB)}${winner}`;
        })
        .join('\n');
      return `**${label}**\n${matches}`;
    })
    .join('\n\n');
}

export function isTournamentButton(interaction) {
  return interaction.customId?.startsWith(`${PREFIX}:`);
}

export async function handleTournamentCommand(interaction) {
  const action = interaction.options.getSubcommand();

  if (action === 'create') {
    const name = interaction.options.getString('name', true).trim();
    const game = interaction.options.getString('game', true).trim();
    const teamCount = interaction.options.getInteger('teams', true);
    const teamSize = interaction.options.getInteger('team-size', true);
    const tournament = {
      id: tournamentId(),
      name,
      game,
      teamCount,
      teamSize,
      capacity: teamCount * teamSize,
      registrants: [],
      teams: [],
      rounds: [],
      status: 'registering',
      champion: null,
      createdBy: interaction.user.id,
      channelId: null,
      messageId: null,
      createdAt: new Date().toISOString(),
    };

    await interaction.deferReply({ ephemeral: true });
    const channel = await resolveTournamentChannel(interaction.guild, interaction.channel);
    if (!channel?.isTextBased()) throw new Error('No text channel is available to publish this tournament.');

    const message = await channel.send({ embeds: [tournamentEmbed(tournament)], components: registrationControls(tournament) });
    tournament.channelId = channel.id;
    tournament.messageId = message.id;
    mutate((data) => {
      data.tournaments[interaction.guildId] ??= {};
      data.tournaments[interaction.guildId][tournament.id] = tournament;
    });

    await interaction.editReply(`Tournament published in ${channel}. Tournament ID: \`${tournament.id}\`.`);
    return;
  }

  const data = snapshot();
  const tournaments = tournamentsFor(data, interaction.guildId);

  if (action === 'list') {
    const list = Object.values(tournaments).filter((tournament) => tournament.status !== 'cancelled');
    const description = list.length
      ? list.slice(0, 15).map((tournament) => `• \`${tournament.id}\` **${tournament.name}** — ${tournament.registrants.length}/${tournament.capacity} • ${statusConfig[tournament.status].label}`).join('\n')
      : 'No active tournaments. Create one with `/tournament create`.';
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('TournamentHub').setDescription(description)] });
    return;
  }

  const id = interaction.options.getString('id', true).toLowerCase();
  const tournament = tournaments[id];
  if (!tournament) {
    await interaction.reply({ content: 'Tournament not found. Run `/tournament list` for a valid ID.', ephemeral: true });
    return;
  }

  if (action === 'bracket') {
    if (!tournament.rounds.length) {
      await interaction.reply({ content: 'The bracket does not exist yet. The host must run `/tournament teams` after registrations are full.', ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`${tournament.name} — bracket`).setDescription(formatBracket(tournament).slice(0, 4096))] });
    return;
  }

  if (!canManage(interaction, tournament)) {
    await interaction.reply({ content: 'Only the tournament host or a server manager can do that.', ephemeral: true });
    return;
  }

  if (action === 'teams') {
    if (tournament.status !== 'registering') {
      await interaction.reply({ content: 'Teams can only be generated while registrations are open.', ephemeral: true });
      return;
    }
    if (tournament.registrants.length !== tournament.capacity) {
      await interaction.reply({ content: `Registrations are not full yet: ${tournament.registrants.length}/${tournament.capacity}.`, ephemeral: true });
      return;
    }

    let updated;
    mutate((current) => {
      updated = current.tournaments[interaction.guildId][id];
      const players = shuffle(updated.registrants);
      updated.teams = Array.from({ length: updated.teamCount }, (_, index) => ({
        id: `T${index + 1}`,
        name: `Team ${teamNames[index]}`,
        players: players.slice(index * updated.teamSize, (index + 1) * updated.teamSize),
      }));
      updated.rounds = buildBracket(updated.teams);
      updated.status = 'active';
      updated.updatedAt = new Date().toISOString();
    });

    await syncCard(interaction.guild, updated);
    const teamText = updated.teams.map((team) => `**${team.id} • ${team.name}**\n${team.players.map((player) => `<@${player}>`).join(', ')}`).join('\n\n');
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`${updated.name} — teams formed`).setDescription(teamText).setFooter({ text: 'Use /tournament bracket to see matches.' })],
    });
    return;
  }

  if (action === 'result') {
    if (tournament.status !== 'active') {
      await interaction.reply({ content: 'Match results can only be reported while a tournament is active.', ephemeral: true });
      return;
    }
    const matchId = interaction.options.getString('match', true).trim();
    const winnerId = interaction.options.getString('winner', true).trim().toUpperCase();
    let outcome;
    let updated;
    mutate((current) => {
      updated = current.tournaments[interaction.guildId][id];
      outcome = reportWinner(updated, matchId, winnerId);
      updated.updatedAt = new Date().toISOString();
    });

    if (!outcome.ok) {
      const messages = {
        'match-not-found': 'That match code does not exist.',
        'match-not-ready': 'That match is not ready yet; both teams must advance first.',
        'match-finished': 'A winner was already reported for that match.',
        'invalid-winner': 'The winner must be one of the two teams shown in the match.',
      };
      await interaction.reply({ content: messages[outcome.reason], ephemeral: true });
      return;
    }

    await syncCard(interaction.guild, updated);
    await interaction.reply(
      outcome.champion
        ? `🏆 **${formatTeam(updated, winnerId)}** won **${updated.name}**!`
        : `Result saved: **${formatTeam(updated, winnerId)}** advances.`,
    );
    return;
  }

  let updated;
  mutate((current) => {
    updated = current.tournaments[interaction.guildId][id];
    updated.status = 'cancelled';
    updated.updatedAt = new Date().toISOString();
  });
  await syncCard(interaction.guild, updated);
  await interaction.reply(`**${tournament.name}** was cancelled and registration buttons were disabled.`);
}

export async function handleTournamentButton(interaction) {
  const [, action, id] = interaction.customId.split(':');
  const data = snapshot();
  const tournament = tournamentsFor(data, interaction.guildId)[id];
  if (!tournament || tournament.messageId !== interaction.message.id) {
    await interaction.reply({ content: 'This tournament card is no longer active.', ephemeral: true });
    return;
  }

  let outcome;
  let updated;
  mutate((current) => {
    updated = current.tournaments[interaction.guildId][id];
    if (updated.status !== 'registering') outcome = 'registration-closed';
    else if (action === 'join') {
      if (updated.registrants.includes(interaction.user.id)) outcome = 'already-joined';
      else if (updated.registrants.length >= updated.capacity) outcome = 'full';
      else {
        updated.registrants.push(interaction.user.id);
        outcome = 'joined';
      }
    } else if (action === 'leave') {
      const index = updated.registrants.indexOf(interaction.user.id);
      if (index === -1) outcome = 'not-joined';
      else {
        updated.registrants.splice(index, 1);
        outcome = 'left';
      }
    }
    updated.updatedAt = new Date().toISOString();
  });

  const messages = {
    joined: 'You joined the tournament.',
    left: 'You left the tournament.',
    'already-joined': 'You are already registered.',
    'not-joined': 'You are not registered for this tournament.',
    full: 'Registration is full. Ask the host to generate teams.',
    'registration-closed': 'Registrations are closed for this tournament.',
  };

  await interaction.update({ embeds: [tournamentEmbed(updated)], components: registrationControls(updated) });
  await interaction.followUp({ content: messages[outcome] ?? 'Could not update registration.', ephemeral: true });
}
