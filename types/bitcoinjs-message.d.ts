declare module "bitcoinjs-message" {
  export function verify(
    message: string | Buffer,
    address: string,
    signature: string | Buffer,
    messagePrefix?: string | null,
    checkSegwitAlways?: boolean,
  ): boolean;
  const _default: { verify: typeof verify };
  export default _default;
}