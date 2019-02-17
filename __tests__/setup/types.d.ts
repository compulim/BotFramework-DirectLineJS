export type Subscription = (() => Promise<any> | any) | ({ unsubscribe: () => Promise<any> | any });

declare function createMockServer({
  playbacks: []
}): ({
  port: number,
  promises: Promise<any>[]
});

declare function random(): number;
declare const subscriptions: Subscription[];
