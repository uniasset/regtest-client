/// <reference types="node" />
export interface Network {
    messagePrefix: string;
    bech32: string;
    bip32: Bip32;
    pubKeyHash: number;
    scriptHash: number;
    wif: number;
}
interface Bip32 {
    public: number;
    private: number;
}
declare type DhttpResponse = Unspent[] | Request | string | number | void | null;
export interface Unspent {
    value: number;
    txId: string;
    vout: number;
    address?: string;
    height?: number;
}
interface Input {
    txId: string;
    vout: number;
    script: string;
    sequence: string;
}
interface Output {
    value: number;
    script: string;
    address?: string;
}
interface Request {
    method?: string;
    url?: string;
    body?: string;
    self?: RegtestUtils;
}
export interface Transaction {
    txId: string;
    txHex: string;
    vsize: number;
    version: number;
    locktime: number;
    ins: Input[];
    outs: Output[];
}
export interface RegUtilOpts {
    APIPASS?: string;
    APIURL?: string;
    network?: Network;
    log_requests?: boolean;
}
export declare class RegtestUtils {
    network: Network;
    canlog: boolean;
    private _APIURL;
    private _APIPASS;
    constructor(_opts?: RegUtilOpts);
    readonly RANDOM_ADDRESS: string;
    dhttp(options: Request): Promise<DhttpResponse>;
    broadcast(txHex: string): Promise<null>;
    mine(count: number): Promise<string[]>;
    height(): Promise<number>;
    fetch(txId: string): Promise<Transaction>;
    unspents(address: string): Promise<Unspent[]>;
    faucet(address: string, value: number): Promise<Unspent>;
    faucetComplex(output: Buffer, value: number): Promise<Unspent>;
    verify(txo: Unspent): Promise<void>;
    randomAddress(): string;
}
export {};
