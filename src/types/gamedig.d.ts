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

  namespace Gamedig {
    function query(options: QueryOptions): Promise<QueryResult>;
  }

  export = Gamedig;
}
