declare module 'gamedig' {
  interface QueryResult {
    name:       string;
    map:        string;
    password:   boolean;
    maxplayers: number;
    players:    Array<{ name?: string; raw?: object }>;
    bots:       Array<{ name?: string }>;
    connect:    string;
    ping:       number;
  }

  class GameDig {
    static query(options: {
      type:          string;
      host:          string;
      port:          number;
      requestRules?: boolean;
    }): Promise<QueryResult>;
  }

  export { GameDig };
}
