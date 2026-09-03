import type {
  LeagueCommand,
  LeagueCommandReceipt,
  LeagueCommandType,
} from "../../../shared/leagueCommandProtocol";

export interface LeagueCommandService {
  execute<TType extends LeagueCommandType>(command: LeagueCommand<TType>): Promise<LeagueCommandReceipt>;
}

export class LeagueCommandError extends Error {
  readonly code: string;
  readonly currentRevision: number | undefined;
  readonly receipt: LeagueCommandReceipt | undefined;

  constructor(input: { code: string; message: string; currentRevision?: number; receipt?: LeagueCommandReceipt }) {
    super(input.message);
    this.name = "LeagueCommandError";
    this.code = input.code;
    this.currentRevision = input.currentRevision;
    this.receipt = input.receipt;
  }
}
