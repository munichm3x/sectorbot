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

  interface QueryOptions {
    type:          string;
    host:          string;
    port:          number;
    requestRules?: boolean;
  }

  function Gamedig(options: QueryOptions): Promise<QueryResult>;

  export = Gamedig;
}
