// Collects all keys across all union members (distributive)
type AllKeys<T> = T extends object ? keyof T : never;

// Collects the value type for key K across all union members
type DistributedValue<T, K extends PropertyKey> =
  T extends Record<K, infer V> ? V : never;

// Non-distributive DeepPartial: merges all union members into a single flat partial type
// instead of producing a union of partials (which breaks incremental object building)
export type DeepPartial<T> = [T] extends [object]
  ? {
      [K in AllKeys<T>]?: DistributedValue<T, K> extends object
        ? DeepPartial<DistributedValue<T, K>>
        : DistributedValue<T, K>;
    }
  : T;
