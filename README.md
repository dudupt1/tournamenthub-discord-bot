# TournamentHub — Discord Tournament Manager

TournamentHub is a Discord tournament-management bot for gaming communities. It combines player registration, automatic team formation and single-elimination brackets in one workflow.

## Features

- Tournament registration cards with Join and Leave buttons.
- Two, four or eight team formats.
- One to five players per team.
- Registration capacity controls.
- Random team generation after registrations fill.
- Automatic single-elimination bracket generation.
- Match result reporting and automatic winner progression.
- Champion declaration after the final match.
- Permission-aware host controls.
- Unit tests for bracket generation and progression logic.

## Setup

```bash
npm install
cp .env.example .env
npm run check
npm test
npm run deploy
npm start
```

## Configuration

```env
DISCORD_TOKEN=your_private_token
CLIENT_ID=your_application_id
GUILD_ID=your_test_server_id
TOURNAMENT_CHANNEL_ID=
```

`TOURNAMENT_CHANNEL_ID` is optional. When blank, tournament cards are published in the command channel.
