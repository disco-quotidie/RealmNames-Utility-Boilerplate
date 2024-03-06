
const bitcoin = require('bitcoinjs-lib');
import ECPairFactory from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
// import * as ecc from 'tiny-secp256k1';
import { createMnemonicPhrase } from './create-mnemonic-phrase';
bitcoin.initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
import BIP32Factory from 'bip32';
import { NETWORK } from "../commands/command-helpers"

const bip32 = BIP32Factory(ecc);

export const toXOnly = (publicKey: any) => {
    // console.log(publicKey)
    return publicKey.slice(1, 33);
}
const bip39 = require('bip39');

export interface KeyPair {
    address: string
    publicKey: string
    publicKeyXOnly: string
    path: string,
    WIF: string
    privateKey?: string
}

export const createKeyPair = async (phrase: string = '', path = `m/44'/0'/0'/0/0`) : Promise<KeyPair> => {
    if (!phrase || phrase === '') {
        const phraseResult = await createMnemonicPhrase();
        phrase = phraseResult.phrase;
    }
    const seed = await bip39.mnemonicToSeed(phrase);
    const rootKey = bip32.fromSeed(seed);
    
    const childNodePrimary = rootKey.derivePath(path);
    // const p2pkh = bitcoin.payments.p2pkh({ pubkey: childNodePrimary.publicKey });
    const childNodeXOnlyPubkeyPrimary = toXOnly(childNodePrimary.publicKey);
    const p2trPrimary = bitcoin.payments.p2tr({
        internalPubkey: childNodeXOnlyPubkeyPrimary,
        network: NETWORK
    });
    if (!p2trPrimary.address || !p2trPrimary.output) {
        throw "error creating p2tr"
    }
    /* const p2pkhPrimary = bitcoin.payments.p2pkh({
        pubkey: childNodePrimary.publicKey,
        network: NETWORK
    });
    // console.log('p2pkhPrimary', p2pkhPrimary, p2pkhPrimary.address.toString())
    */
    // Used for signing, since the output and address are using a tweaked key
    // We must tweak the signer in the same way.
    const tweakedChildNodePrimary = childNodePrimary.tweak(
        bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkeyPrimary),
    );

    // Do a sanity check with the WIF serialized and then verify childNodePrimary is the same
    const wif = childNodePrimary.toWIF();
    const keypair = ECPair.fromWIF(wif);

    if (childNodePrimary.publicKey.toString('hex') !== keypair.publicKey.toString('hex')) {
        throw 'createKeyPair error child node not match sanity check'
    }

    // console.log(p2trPrimary.address)
    // console.log(childNodePrimary.toWIF())
    // console.log(JSON.stringify(p2trPrimary))
    // console.log(path)
    // console.log(childNodePrimary.privateKey?.toString('hex'))
    // console.log(childNodePrimary.publicKey?.toString('hex'))
    // console.log(childNodeXOnlyPubkeyPrimary.toString('hex'))

    // console.log(rootKey.privateKey?.toString())
    // console.log(rootKey.privateKey?.toString())

    return {
        address: p2trPrimary.address,
        publicKey: childNodePrimary.publicKey.toString('hex'),
        publicKeyXOnly: childNodeXOnlyPubkeyPrimary.toString('hex'),
        path,
        WIF: childNodePrimary.toWIF(),
        privateKey: childNodePrimary.privateKey?.toString('hex'),
    }
}
export interface WalletRequestDefinition {
    phrase?: string | undefined
    path?: string | undefined
}

export const createPrimaryAndFundingImportedKeyPairs = async (phrase?: string | undefined, path?: string | undefined, n?: number) => {
    let phraseResult: any = phrase;
    if (!phraseResult) {
        phraseResult = await createMnemonicPhrase();
        phraseResult = phraseResult.phrase;
    }
    let pathUsed = `m/44'/0'/0'`;
    if (path) {
        pathUsed = path;
    }
    const imported: any = {}

    if (n) {
        for (let i = 2; i < n + 2; i++) {
            imported[i+''] = await createKeyPair(phraseResult, `${pathUsed}/0/` + i)
        }
    }
    return {
        wallet: {
            phrase: phraseResult,
            primary: await createKeyPair(phraseResult, `${pathUsed}/0/0`),
            funding: await createKeyPair(phraseResult, `${pathUsed}/1/0`)
        },
        imported
    }
}

export const createNKeyPairs = async (phrase: any, n = 1) => {
    const keypairs: any = [];
    for (let i = 0; i < n; i++) {
        keypairs.push(await createKeyPair(phrase, `m/44'/0'/0'/0/${i}`));
    }
    return {
        phrase,
        keypairs,
    }
}
