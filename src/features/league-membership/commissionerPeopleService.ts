import {
  createLeagueInvitationCommand,
  provisionSeasonTeamsCommand,
  removeLeagueMemberCommand,
  revokeLeagueInvitationCommand,
} from "../league-domain/leagueCommands";
import { loadLeaguePeople } from "./leaguePeople";

export type CommissionerPeopleService = {
  load: typeof loadLeaguePeople;
  provisionTeams: typeof provisionSeasonTeamsCommand;
  createInvitation: typeof createLeagueInvitationCommand;
  revokeInvitation: typeof revokeLeagueInvitationCommand;
  removeMember: typeof removeLeagueMemberCommand;
};

export const defaultCommissionerPeopleService: CommissionerPeopleService = {
  load: loadLeaguePeople,
  provisionTeams: provisionSeasonTeamsCommand,
  createInvitation: createLeagueInvitationCommand,
  revokeInvitation: revokeLeagueInvitationCommand,
  removeMember: removeLeagueMemberCommand,
};
